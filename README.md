# 森(morinoki)

> ひとりが一本の樹になり、クラスはひとつの森になる。
> 自分を、キーワードで植える。

**本番**: https://morinokki.vercel.app

## 概要

現実の森の**上空視点**で、一人ひとりが自分の樹を植える自己紹介ウェブアプリ。樹は「名前の幹」と「キーワードの枝葉」でできており、似たキーワードを持つ樹同士は、地中の菌根ネットワークを通じてゆっくり引き寄せ合う。森は常にゆらいでおり、時刻や季節で色が変化する。

- ルーム(森)は招待URLで共有
- 合言葉で自分の樹だけ自分で編集
- 他ユーザーの変更はSupabase Realtimeで数秒以内に反映

---

## 使い方

### 1. 森をつくる
1. https://morinokki.vercel.app を開く
2. 森の名前とURLを決める → **森をつくる**
3. 発行された `https://morinokki.vercel.app/r/<slug>` を仲間に共有(右上の↗ボタンで QRコードも出せる)

### 2. 樹を植える
1. URLにアクセスして **+ 樹を植える**
2. 名前・合言葉(4〜10桁)・メール(任意)を入力
3. **復元キー**が一度だけ表示されるので必ず控える

### 3. キーワードを育てる
- 左パネルに入力欄 → 枝先に色つきのノードが生えて追加
- ノードをタップ: サイズ(XS/S/M/L/XL)・色・説明・削除
- ノードから**子ノード(孫)**も追加可能

### 4. 森で遊ぶ
- 幹をドラッグ: 樹の位置を動かす(自分の樹のみ)
- 枝先ノードをドラッグ: そのキーワードだけ動かす
- 他人の樹をタップ: 共通キーワードと近くにいる樹を表示 → **散歩**ボタンで近い樹へ遷移
- 右上 ⚘: 別端末からの復元(名前+合言葉 or 復元キー)
- 画面下の「タイムラプス」: 森の成長を時系列で再生
- idle画面の「森をCSVで書き出す」: 主催者向けエクスポート

---

## 技術スタック

- **フロント**: Vanilla ESM JavaScript + Canvas 2D(ビルドツールなし)
- **描画**: 自作軽量シミュレーション(`js/liveforest.js`)。D3.js不使用
- **バックエンド**: Supabase(Postgres + Realtime Broadcast + RPC)
- **配信**: Vercel static + rewrite(`/r/:slug → /room.html`)
- **フォント**: Google Fonts(Shippori Mincho, Klee One)
- **QR**: api.qrserver.com(外部サービス)

### ファイル構成
```
.
├── index.html / room.html              # 2画面の静的HTML
├── js/
│   ├── app.js                          # 画面遷移、state store、イベントワイヤリング
│   ├── supabase.js                     # Supabaseクライアント + RPC薄ラッパ
│   ├── auth.js                         # localStorage session管理
│   ├── realtime.js                     # broadcast購読 + 指数バックオフ再接続
│   ├── liveforest.js                   # ゆらぎ / 類似引力 / 斥力 / 成長アニメ
│   ├── forest.js                       # Canvas描画、pan/zoom、ドラッグ
│   ├── tree.js                         # 樹の描画(幹+枝+孫ノード)、seedベース位置計算
│   ├── editor.js                       # 左常駐パネルと各種モーダル
│   ├── atmosphere.js                   # 時間帯+季節の色調
│   ├── toast.js                        # 通知 + 接続状態バナー
│   └── utils.js                        # 純粋関数
├── css/main.css
├── supabase/migrations/
│   ├── 000_combined.sql                # 下記5migrationをまとめて初期化用
│   ├── 001_init.sql                    # rooms/trees/nodes + RPC + JWT署名
│   ├── 002_detail_drag.sql             # description, offset_x/y, update_tree_position
│   ├── 003_nested.sql                  # nodes.parent_id(孫ノード)
│   ├── 004_realtime.sql                # supabase_realtime publication
│   ├── 005_realtime_replica.sql        # REPLICA IDENTITY FULL + grants
│   └── 006_broadcast.sql               # notify triggers + realtime.send
├── vercel.json                         # /r/:slug rewrite
├── test-*.mjs                          # Playwright E2E(Phase 0〜5)
└── .github/workflows/ci.yml            # 構文チェック + 必須IDチェック
```

---

## セットアップ(新規Supabaseプロジェクト)

1. Supabase で新規プロジェクト作成(リージョン任意)
2. **SQL Editor** で `supabase/migrations/000_combined.sql` を全文貼って実行(「Run and enable RLS」でOK)
3. `index.html` と `room.html` の `window.SUPABASE_CONFIG` に URL と anon key を記入
4. Vercelへデプロイ(または任意の静的ホスト)

### 再デプロイ
```bash
git push  # Vercelが自動デプロイ
```

---

## データモデル

```
rooms(id, slug, name, created_at)
trees(id, room_id, name, passcode_hash, recovery_key_hash, recovery_email,
      seed, x, y, created_at, updated_at)
nodes(id, tree_id, parent_id, text, size, color, ord,
      description, offset_x, offset_y, created_at)
_config(key, value)  -- アプリ内設定(jwt_secret等、RLSで完全遮断)
```

### 主要RPC(全て `security definer`)
- `create_room(slug, name) → rooms row`
- `create_tree(room_slug, name, passcode, email) → {tree_id, recovery_key}`
- `auth_tree(tree_id, passcode_or_recovery_key) → edit_token (JWT HS256, 7日)`
- `upsert_node(token, tree_id, id, text, size, color, ord, description, offset_x, offset_y, parent_id)`
- `delete_node(token, node_id)`
- `update_tree_position(token, tree_id, x, y)`
- `sign_edit_token / verify_edit_token` (内部)

### Realtime同期
`006_broadcast.sql` のトリガが INSERT/UPDATE/DELETE で `realtime.send()` を呼び、`room:<room_id>` チャンネルに `tree_change` / `node_change` イベントを送信。クライアントは該当チャンネルを購読し、debounce 500msで `reload` + 再描画。

---

## 開発

```bash
# ローカル配信
npx http-server . -p 8765

# 構文チェック
for f in js/*.js; do node --input-type=module --check < "$f"; done

# Playwright E2E
node test-phase4.mjs        # モバイル/toast/CSV/offline
TARGET_BASE=https://morinokki.vercel.app node test-phase4.mjs
```

---

## Phase 進捗

| Phase | 内容 |
|---|---|
| 0+1 | Supabase設定、HTMLスケルトン、合言葉、ノードCRUD、上空視点描画 |
| + | 左常駐パネル、一人一樹、幹大型化+名前内包、孫ノード、ドラッグ移動 |
| 2 | Realtime同期(broadcast)、ゆらぎ、類似引力、成長アニメ |
| 3 | 時間帯演出、共有+QR、復元モーダル、共通キーワード+近くの樹 |
| 4 | Toast、モバイル最適化、ピンチズーム、再接続、CSV書き出し |
| 5 | 季節テーマ、散歩モード、森タイムラプス |

---

## 今後の拡張余地(未実装)

- **AI埋め込み類似度**: OpenAI `text-embedding-3-small` で「ピアノ」と「音楽」のような意味的類似。Supabase Edge Function経由で実装するとanonキー露出を避けられる
- **メール magic link による合言葉リセット**: Supabase Authと連携
- **主催者ダッシュボード**: ルーム作成者の識別 + リセット承認UI
- **アクセシビリティ**: スクリーンリーダー、キーボード完全操作

---

## ライセンス / 注意事項

- 個人/教育利用想定のプロトタイプ
- 合言葉は4桁が最低。重要データ用途ではありません
- `anon key` はクライアントに露出するが、書き込みは `security definer` RPC + RLS で防御
