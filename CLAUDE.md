# 森(morinoki) — Claude Code 引き継ぎ

> Claude Codeはこのファイルを起動時に自動で読み込む。プロジェクトの**現在状態**と**作業ルール**のみを記載(仕様詳細は README.md 参照)。

## プロジェクト現在地

- **状態**: Phase 0〜5 + 運用作業まで完了。本番(https://morinoki.vercel.app)で運用可能
- **コードベース**: Vanilla ESM JavaScript、ビルドツールなし、`js/*.js` で責務別
- **バックエンド**: Supabase(Postgres + Realtime Broadcast)
- **配信**: Vercel static + GitHub Actions(syntax check)

## Phase別に実装されたもの

| Phase | 内容 | 主要ファイル |
|---|---|---|
| 0-1 | Supabase基盤、HTML、合言葉、ノードCRUD、上空視点描画 | `supabase.js`, `auth.js`, `tree.js` |
| 追加 | 左常駐パネル、一人一樹、幹大型化、孫ノード、ドラッグ | `editor.js`, `forest.js` |
| 2 | Realtime broadcast、ゆらぎ、類似引力、成長アニメ | `realtime.js`, `liveforest.js` |
| 3 | 時間帯演出、共有+QR、復元、共通キーワード、散歩 | `atmosphere.js`, `editor.js` |
| 4 | Toast、モバイル最適化、再接続、CSV | `toast.js` |
| 5 | 季節テーマ、タイムラプス | `atmosphere.js`, `app.js` |

## Supabase migrations(全て本番適用済)

- `001_init.sql` — rooms/trees/nodes、RPC、RLS、JWT署名
- `002_detail_drag.sql` — description, offset, update_tree_position
- `003_nested.sql` — nodes.parent_id(孫)
- `004_realtime.sql` — publication
- `005_realtime_replica.sql` — replica identity full + grants
- `006_broadcast.sql` — notify triggers + realtime.send
- `000_combined.sql` — 上記を1枚に集約(新プロジェクト初期化用)

## 作業ルール

### コード変更時
1. `js/*.js` を編集したら `node --input-type=module --check < js/xx.js` で構文チェック
2. 既存デザイン思想(和紙/苔/樹皮/金/蕾、上空視点、幹+枝+葉)を保つ
3. AI風(紫グラデ、Inter、Material Design)は避ける

### DB変更時
1. `supabase/migrations/NNN_name.sql` として新規ファイル追加
2. **適用方法**: Supabase SQL Editor か、Session Pooler経由の `pg` クライアント
   - Pooler URL: `postgresql://postgres.wlxqavbrarthldodiqyp:<PW>@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`
   - **注意**: 直接接続 `db.<ref>.supabase.co:5432` はIPv6のみでこの端末から不可
3. `000_combined.sql` も更新

### 新機能追加
1. 個別モジュール化優先(`js/xxx.js` 単体で動くように)
2. `app.js` の `initRoom()` でwiring
3. Playwright E2Eを `test-phaseN.mjs` に追加
4. `README.md` の Phase 表に行追加

### デプロイ
```bash
git add -A && git commit -m "..." && git push
vercel deploy --prod --yes  # またはGitHub連携で自動
```

### E2E実行
```bash
# ローカル http-server を起動しておく
npx http-server . -p 8765

# 本番向けテスト(全phase)
for t in test-phase*.mjs; do TARGET_BASE=https://morinoki.vercel.app node "$t"; done
```

## 秘密情報の扱い

- `.jwt-secret`, `.dburl` は `.gitignore` 済。**commitしない**
- `anon key` は `index.html`/`room.html` に平文埋め込みOK(公開前提)
- DBパスワードは作業後にリセット推奨

## 既知の制約 / トラブルシュート

- **postgres_changes が TIMED_OUT する**: このプロジェクトはpostgres_changes用のreplication slotが作成されず、broadcast方式に切替済。`006_broadcast.sql` のtriggerで実現
- **`db.xxx.supabase.co` のDNSがIPv6のみ**: 直接接続は不可、Session Pooler(port 5432) or Transaction Pooler(port 6543)を使用
- **IPv4 poolerリージョン**: `aws-1-ap-southeast-1`(プロジェクトのリージョンはダッシュボードで確認)
- **setAuth必要**: supabase-jsの`realtime.accessTokenValue`は初期undefined。`await supabase.realtime.setAuth(anonKey)`してから`channel.subscribe()`しないとTIMED_OUT

## ユーザーの好み

- 日本語で対話
- 指示: "実装開始" → そのまま実装、"途中で止まらず" → ゆらぎ/失敗時も継続
- ドキュメントは`README.md`中心、過剰な`.md`生成は避ける(プロジェクトに `Hook: BLOCKED: Unnecessary documentation file creation` がある)
- `CONTRIBUTING.md` は実装計画を格納(個別の`PLAN.md`は避ける)

## 参考

- `reference/wordmap/` — 元のD3ベースwordmap(設計時の参考)
- `mori.html` — v1プロトタイプ(単一HTML版、保存のみ)
- 詳細仕様: `README.md`
