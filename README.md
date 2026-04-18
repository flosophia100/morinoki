# 森(morinoki) v2 改良企画書

**作成日**: 2026-04-19
**対象**: `C:/Users/fubas/Documents/morinoki/`
**ベース**: `mori.html` (v1) + `reference/wordmap/` (D3 force simulation の参考実装)
**目的**: 単一HTMLのローカルMVP(v1) を、複数ユーザーが共有URLでアクセスし「生きている森」として育てていけるWebアプリ(v2)へ進化させる。

---

## 1. プロダクト・コンセプト

### 一言で
**「森のいきものたち」** — URLを共有すれば、クラスやコミュニティ単位で森(ルーム)が立ち上がる。メンバーは自分の樹を植え、キーワードを足すと枝が伸びる。似たキーワードを持つ樹同士は、地中の菌根ネットワークを通じて枝先で静かに近づいていく。

### 世界観の核(v1から維持)
- 現実の森の**上空視点(トップダウン)** で描く
- ひとり=一本の樹。樹は名前と複数のキーワードから成る有機体
- 似た想いを持つ樹同士は、地中の菌根で繋がっている(直接は見えない)
- 森は常に**ゆらいでいる**。完全停止せず、呼吸し、風に揺れ、時間帯で色が変わる
- 和紙・苔・樹皮・土根・金・蕾 の色彩。派手なAIグラデやInter系は避ける

### v1からの主な進化
| 観点 | v1 (mori.html) | v2 |
|---|---|---|
| 画面 | Welcome / Build / Forest の3画面 | **1画面統合**(森の中で直接編集) |
| 視点 | 側面視点(幹・枝・根が上下に分かれる) | **上空視点**(canopyが円形に見える) |
| カテゴリ | roots / interest / future の3分類 | **廃止**。各ノードは自由にサイズと色を設定 |
| つながり表現 | 金色の光の線 | **距離のみ**で表現(線は描かない) |
| 配置 | グリッド配置 + ランダムオフセット | **D3 force simulation**。類似ノードが引き合う |
| 動き | 静止 | **常時ゆらぎ**(パーリンノイズ + alphaDecay=0) |
| 永続化 | `window.storage`(Claude artifacts) | **Supabase**(Postgres + Realtime) |
| 利用形態 | ローカル | **Vercelで公開、招待URLで複数ユーザー同時利用** |
| 編集権 | 全員が誰でも編集 | **ルーム分離 + 自分の樹だけ編集**(合言葉) |

---

## 2. 核になる体験ループ

1. ユーザーが**招待URL** (`/r/{slug}`) を開く
2. 上空から見た森が広がる。既に植わっている樹たちはゆっくり呼吸し、枝先がさわさわ動いている
3. 空いている地面をタップ、または右下の **+** → 種が落ちる演出
4. インラインの植樹パネルで名前と合言葉を入力 → 若木が芽吹く(1.5秒の成長アニメ)
5. **復元キー** が一度だけ表示される(例: `ayame-5821-moss`) → コピーを促す
6. 続けてキーワードを追加 → 枝が伸びて先端にノード(色つきの丸)が現れる
7. 他の樹と同じキーワードがあれば、その枝先が互いに近づくように**ゆっくり動く**(数秒)
8. 他の人の樹をタップすると詳細ボトムシート → 共通のキーワード / 近くにいる樹 が表示される
9. 後日URLを開き直すと、自分の樹は淡く光る輪でハイライトされ、即編集できる(合言葉は `localStorage` の edit_token が有効な間は省略)

---

## 3. 設計方針

### 権限モデル (A + D)
- **D: ルーム(招待URL)で森を分離**。1 URL = 1森。クラスや小コミュニティ単位
- **A: 自分の樹だけ自分で編集**。他人の樹は閲覧のみ
- **合言葉方式**: 樹作成時に4桁の合言葉を設定。`localStorage` に保存される `edit_token`(サーバー署名のJWT、有効期限7日)で継続編集可
- **ブルートフォース対策**: `auth_tree` RPC に IP+tree_id単位のレート制限(1分あたり5回、以後は指数的に遅延)をサーバー関数内で実装。4桁は体験優先の選択であり、重要資産を守る用途ではないことを前提とする

### 合言葉忘却対策(三段構え)
1. **自動生成の復元キー**: 植樹直後に一度だけ画面表示(例 `ayame-5821-moss`)。コピー推奨
2. **メールアドレス任意登録**: 登録者は Supabase Auth magic link で再設定可
3. **ルーム主催者のリセット承認**(Phase 4): 主催者ダッシュボードから樹の合言葉リセットを承認

### つながりの表現
- 金色の光の線は**描かない**
- 類似性は**距離**でのみ表現 → force simulation が似たノードを引き寄せる
- 結果として、似た興味を持つ樹がなんとなく同じエリアに集まる地形が自然発生する

### 樹の動き(生きている森)
- **幹**: 弱い位置バネ(`d3.forceX/Y` 低強度)。完全に固定ではなく、枝の引力で徐々に漂う
- **枝先ノード**: 幹からの枝拘束(`d3.forceLink`)+ 他樹の類似ノードとの引力(カスタム)
- **風**: 全ノードにパーリンノイズベースの微小振動 → 葉が揺れ、森が呼吸する
- `d3.forceSimulation().alphaDecay(0)` で常時シミュレーション、止まらない森

### ジェネラティブ演出(3層)
- **成長アニメ**: 新しい樹は種→若木→成木へ(1.5〜2秒)。新ノード追加で枝が伸びる(0.8秒)
- **環境演出**: 端末のローカル時間で朝霧 / 昼 / 夕 / 夜 の色調を body 背景に適用
- **Force可視化**: 他ユーザーの変更が Supabase Realtime で届くと、森がゆらっと再平衡する様子が見える

---

## 4. 技術アーキテクチャ

### スタック
- **フロント**: 素のHTML/CSS/JS(ビルドツールなし、ESM `<script type="module">`)
- **描画**: Canvas 2D
- **レイアウト**: D3.js v7 の `d3-force` / `d3-quadtree` のみ(CDN ESM)
- **バックエンド**: Supabase(Postgres + Realtime + Auth + RPC)
- **配信**: Vercel(静的ホスティング)
- **フォント**: Google Fonts(Shippori Mincho, Klee One)

### Supabase スキーマ

```sql
create table rooms (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text,
  created_at timestamptz default now()
);

create table trees (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  passcode_hash text not null,
  recovery_key_hash text not null,
  recovery_email text,
  seed bigint not null,
  x numeric default 0,
  y numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table nodes (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references trees(id) on delete cascade,
  text text not null,
  size smallint default 3 check (size between 1 and 5),
  color text default '#5a6b3e',
  ord smallint default 0,
  created_at timestamptz default now()
);

create index idx_trees_room on trees(room_id);
create index idx_nodes_tree on nodes(tree_id);
```

カテゴリなし、接続テーブルなし(類似は距離で表現するため線を保存しない)。

### RLS(Row-Level Security)
- **読み取り**: `rooms` / `trees` / `nodes` は匿名 SELECT 可(ルームURL = slug が合言葉代わり)
- **書き込み**: クライアントからの直接 INSERT/UPDATE/DELETE は**全面禁止**
- すべて `security definer` の RPC 関数経由。サーバー側で合言葉 / edit_token を検証

### 主要RPC関数
```
create_room(slug text, name text)
  → rooms row

create_tree(room_slug text, name text, passcode text, email text?)
  → { tree_id uuid, recovery_key text }   -- recovery_key は一度だけ返す

auth_tree(tree_id uuid, passcode_or_recovery_key text)
  → { edit_token text }   -- 7日有効の署名付きJWT(payload: { tree_id, exp })

upsert_node(edit_token text, tree_id uuid, node jsonb)
  → nodes row

delete_node(edit_token text, node_id uuid)
  → void

update_tree_position(edit_token text, tree_id uuid, x numeric, y numeric)
  → void   -- force sim の中間状態を定期バッチで保存

reset_passcode_with_recovery_key(tree_id uuid, recovery_key text, new_passcode text)
  → void

request_passcode_reset_by_email(tree_id uuid, email text)
  → void   -- Supabase Auth の magic link を送信
```

### リアルタイム同期
- Supabase Realtime で `trees` と `nodes` を `filter: room_id=eq.{roomId}` で購読
- 他ユーザーの INSERT / UPDATE / DELETE が数秒以内に全員の画面に反映
- ローカル force simulation は稼働し続け、データ差分でノード追加/削除するだけ

### Vercel設定
- 静的配信。`vercel.json` で `/r/:slug → /room.html` の rewrite
- 環境変数: `SUPABASE_URL`, `SUPABASE_ANON_KEY`(anon key はクライアント公開OK、書き込みはRPCで守る)

---

## 5. 画面・UIフロー

### 画面は 1つ(`room.html`)
```
┌──────────────────────────────────────┐
│ ≡ 3年A組の森          12本の樹    ⚙ │  ← 薄いヘッダ(半透明)
│                                      │
│       (上空から見た森)                │
│                                      │
│       樹  樹    樹                   │
│      樹    樹  樹                    │
│         樹   樹                      │
│                                      │
│                                      │
│                     ⓘ       +      │  ← フッタ(半透明、最小)
└──────────────────────────────────────┘
```
- ヘッダ: 森名 / 樹数 / 設定(ゆらぎOFF / 時間帯固定 / ログアウト)
- フッタ: 現在地インジケータ / **+ボタン**(樹を植える)
- パン: ドラッグ。ズーム: ピンチ / ホイール

### エントリ画面(`index.html`)
- **新しい森を作る** → 森名入力 → slug自動生成(編集可) → URLコピー → 森へ
- 招待URLで来たユーザーは直接 `/r/{slug}` から `room.html` へ

### 樹を植えるフロー
1. **+** または空地タップ → 種が落ちる演出
2. 植樹パネル(下からスライドアップ):
   - 名前(必須)
   - 合言葉(4桁・2回入力)
   - メール(任意・復元用)
   - [植える]
3. 種 → 若木 の成長アニメ(1.5秒)
4. **復元キー表示モーダル** → [コピー][保存した]
5. 自動でノード編集モードに入る

### ノード追加・編集(インライン)
自分の樹タップ → 樹のそばにミニパネル:
```
┌─────────────┐
│ キーワード…  ＋ │
│               │
│ パン作り 🔴M  │  ← タップで編集
│ 北海道   🟢S  │
│ 本読む   🟤L  │
│     [閉じる]   │
└─────────────┘
```
- ノード編集ポップオーバー: テキスト / サイズ(XS..XL) / 色(10色パレット) / 削除
- 変更は即 Supabase RPC → Realtime で全員に反映 → forceが緩やかに再平衡

### 他人の樹タップ → 詳細ボトムシート
- 名前 / 植樹日 / 全キーワード
- **共通キーワード**(自分の樹と類似判定が高いもの)
- **近くにいる樹**(force sim上の距離が近い top 3)

### 再訪問フロー
- URL開く → 森表示
- `edit_token` 有効 → 自分の樹に淡く光る輪 → タップで即編集
- 別端末 or トークン切れ → 自樹タップ時「合言葉を入力」ダイアログ
  - [復元キーで入る] / [メールで再設定] のリンクも表示

### ゼロ状態
- 樹ゼロ: 森の中央に「ここに最初の樹を植えてみよう」 + 種のイラスト + **+**
- 樹一本のみ: 「最初の一本目が立ちました。URLを共有しましょう」 + [URLコピー]

---

## 6. ファイル構成

ビルドツールなし、静的配信。mori.htmlの単一ファイル精神を引き継ぎつつ、責務単位で最小限分割。

```
morinoki/
├── README.md                     # 本文書(企画書兼引継ぎ資料)
├── CLAUDE.md                     # Claude Code用引継ぎ
├── mori.html                     # 旧版v1、リファレンスとして保持
├── reference/
│   └── wordmap/                  # wordmap一式コピー(force実装の見本)
│
├── index.html                    # エントリ: 新規作成 or 参加
├── room.html                     # 森ビュー(森+インライン編集すべて)
│
├── js/
│   ├── app.js                    # ルーティング・画面状態
│   ├── forest.js                 # D3 force + Canvas描画ループ
│   ├── tree.js                   # 樹/ノードのジェネラティブ描画(上空視点)
│   ├── editor.js                 # 植樹フロー・インライン編集UI
│   ├── supabase.js               # DB / Realtime / RPC ラッパー
│   ├── auth.js                   # 合言葉 / edit_token 管理(localStorage)
│   └── utils.js                  # stringHash / seededRandom / perlin / 色 / dom helpers
│
├── css/
│   └── main.css
│
├── supabase/
│   ├── migrations/
│   │   └── 001_init.sql          # rooms / trees / nodes + RPC + RLS
│   └── seed.sql                  # 開発用サンプル
│
└── vercel.json                   # `/r/:slug` → `/room.html` rewrite
```

### モジュールの責務
- **`app.js`**: 画面遷移・state store・`supabase.js`から取得したデータを`forest.js`に渡す
- **`forest.js`**: Canvas描画ループ、D3 force simulation、ユーザー操作(ドラッグ・ズーム)
- **`tree.js`**: 一本の樹を上空視点で描画する純粋関数。名前ラベル・canopy・葉ノード
- **`editor.js`**: 植樹モーダル、インラインノードパネル、ポップオーバー
- **`supabase.js`**: RPC呼び出し・Realtime subscription・エラー処理
- **`auth.js`**: 合言葉検証・edit_token永続化・復元フロー
- **`utils.js`**: 純粋関数のみ(ハッシュ、乱数、ノイズ、色変換、DOMヘルパ)

---

## 7. 実装フェーズ

### Phase 0: セットアップ(半日)
- [x] `reference/wordmap/` にwordmapコピー済
- [ ] Supabase プロジェクト作成、`001_init.sql` 適用
- [ ] Vercel プロジェクト作成 & GitHub接続
- [ ] 環境変数(`SUPABASE_URL`, `SUPABASE_ANON_KEY`)をVercelに登録
- [ ] 空の `index.html` / `room.html` が Vercelで表示できることを確認

### Phase 1: MVP(動くアプリ)
- [ ] `index.html`: 新規森作成フォーム(名前 → slug → URL発行)
- [ ] `room.html`: ルーム読込、既存樹を表示(force simulationまだ無し、ランダム配置)
- [ ] 植樹フロー(名前 + 合言葉 + 復元キー表示 + メール任意)
- [ ] ノードの追加 / 編集(サイズ・色) / 削除
- [ ] edit_token を localStorage保存、再訪時に即編集可
- [ ] 上空視点の樹の静止描画(canopy = 円 + 葉ノード)
- [ ] 最低限のスタイル
- **ゴール**: 一人〜数人で触って「森ができた」と実感できる状態

### Phase 2: 生きている森
- [ ] D3 force simulation 導入(`d3-force` をCDN ESMで読込)
- [ ] 幹(位置バネ)+ 枝(link force)+ 類似ノード引力 のカスタム力学
- [ ] `alphaDecay(0)` で常時稼働
- [ ] パーリンノイズの風を全ノードに加算
- [ ] 成長アニメ(種→若木、枝が伸びる)
- [ ] Supabase Realtime で他ユーザーの変更がライブ反映
- [ ] `update_tree_position` を 10秒ごとにバッチでSupabaseに保存
- **ゴール**: 別ブラウザ/別端末で開いて、互いの変更が数秒以内に反映される「呼吸する森」

### Phase 3: 詩性を深める
- [ ] 時間帯演出(朝霧 / 昼 / 夕 / 夜、端末ローカル時刻ベース)
- [ ] 他樹タップの詳細ボトムシート(共通キーワード・近くの樹)
- [ ] 復元キーでの合言葉リセット
- [ ] メール magic link でのリセット(Supabase Auth)
- [ ] 招待URLコピー / QRコード生成

### Phase 4: 仕上げ
- [ ] ルーム主催者向け簡易ダッシュボード(樹一覧・合言葉リセット承認)
- [ ] モバイル最適化(safe-area、タップターゲット、ピンチズーム)
- [ ] エラーハンドリング(オフライン / RPC失敗 / Realtime切断)
- [ ] パフォーマンス調整(50本 × 10ノード/樹 で60fps維持)
- [ ] 軽いテスト(`auth.js` の合言葉検証など純粋関数をユニットテスト)

---

## 8. 設計判断の記録(なぜこうしたか)

| 判断 | 選ばれた選択肢 | 理由 |
|---|---|---|
| 権限モデル | ルーム分離 + 自分の樹編集 | 自己紹介アプリの性質上、荒らしリスクを抑えつつ自分の表現は自由に |
| バックエンド | Supabase | Postgres + Realtime + Auth がワンストップ。無料枠で20〜50人規模OK |
| 配信 | Vercel | 静的配信で十分。GitHub連携でCI/CD自動化 |
| wordmapの統合 | D3 force部分のみ流用 | morinokiの世界観を崩さず、必要な力学エンジンだけ取り込む |
| 画面構成 | 1画面統合 | 「森の中で直接育てる」没入感。ウェルカム画面は廃止 |
| 視点 | 上空(トップダウン) | 「森を見渡す」体験。菌根ネットワークが地中を走る比喩と整合 |
| カテゴリ | 廃止 | 表現の自由度を優先。代わりにノード個別のサイズ・色で個性を表現 |
| つながり表現 | 線を描かず距離のみ | 「見えないつながり」の詩性。実装もシンプル |
| 力学モデル | 幹=弱バネ、枝先=引力、風=常時ノイズ | 生きている森の表現。完全静止は避ける |
| ビルドツール | なし(素のESM) | mori.htmlの精神。依存管理・ビルド時間のコスト回避 |

---

## 9. 将来拡張(v2完成後に検討)

- **AI埋め込みベースの類似判定**: 文字列ベース → OpenAI `text-embedding-3-small` 等でセマンティック類似。「ピアノ」と「音楽」が近づく
- **全体テーマ俯瞰**: AIがルーム全体のキーワードを要約、「このクラスの共通テーマは○○」
- **森を散歩するモード**: 近接ノードを辿って樹から樹へ遷移
- **時系列リプレイ**: 森の成長をタイムラプスで振り返る
- **SNS共有用の画像書き出し**

---

## 10. 成功基準

- 招待URLを配布し、20人のクラスで全員が樹を植え終えるまで **5〜10分**で完了できる
- 誰かが新しいキーワードを足すと、他の全員の画面に **10秒以内** に反映される
- 森を開いた瞬間に「生きている」と感じる(静止していない、時間帯で色が違う)
- 50本の樹 × 10ノード/樹 の森で **60fps を維持**(ミドルレンジのスマホ)
- 合言葉を忘れても復元手段が必ず1つ以上使える(復元キー / メール / 主催者承認)

---

## 付録A: 対応する v1 の要素

| v1 (mori.html) | v2 での扱い |
|---|---|
| 3カテゴリ(roots/interest/future) | 廃止。ノード個別のサイズ・色で表現 |
| 側面視点の樹描画 | 廃止。上空視点のcanopy+葉に置換 |
| 金色の光の線(connections) | 廃止。距離表現に一本化 |
| `stringHash` + `seededRandom` | 維持。`trees.seed` として Supabase に保存、ジェネ再現性を確保 |
| 3画面ナビゲーション | 1画面統合 |
| `window.storage` | Supabase に置換 |
| シンプルな類似判定(Jaccard / substring) | 維持(MVP)。将来は埋め込みベースに差し替え可能な抽象化 |
| 和紙・苔・樹皮・金・蕾 の色彩 | 完全維持 |
| Shippori Mincho / Klee One フォント | 完全維持 |

## 付録B: 参照ファイル

- `morinoki/mori.html` — v1実装(側面視点、3カテゴリ、`window.storage`)
- `morinoki/reference/wordmap/` — wordmap v3.2.0 コピー
  - `wordmap-core.js`: D3WordMapEditor クラス(force simulation実装の参考)
  - `config.js`: force パラメータのチューニング値
  - `REQUIREMENTS.md`: wordmap の要件定義(参考)
- `morinoki/CLAUDE.md` — プロジェクト引継ぎ資料(v1時点)
