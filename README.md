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

## ゆらぎ(motion)仕様

最小構成の設計思想。drift / velocity / spring / 引力などの**動的シミュレーションは持たず**、
`Math.sin / Math.cos` の純粋関数で毎フレーム位置を直接代入する。

### 合成式

```
tree._displayX = tree.x + tree._swayX
node display   = tree._displayX + offset_x + simDX   (= rest + simDX)
```

`tree._swayX/_swayY` と `n.simDX/simDY` はすべてクライアントローカルの視覚演出。DB には保存しない。

### 幹 sway (`js/liveforest.js`)

```js
const seed = stringHash(tree.id);
_swayX = (sin(t*0.09 + pX) * 110 + sin(t*0.045 + pX*1.7) * 55) * ampMul;
_swayY = (cos(t*0.075 + pY) * 90 + cos(t*0.038 + pY*1.3) * 40) * ampMul;
```

- 2周期を重ねて複雑な軌跡
- 位相は `tree.id` ハッシュ由来 → 樹ごとに独立
- `ampMul = 0.25 + shimmerAmp * 2.75`、`speedMul = 0.4 + shimmerSpeed * 1.2`

### ノード sway (`js/nodesim.js`)

```js
const ph = (id[0]+id[1])*0.17 + text.length*0.11;
const amp = swayAmp(depth);
simDX = sin(t*0.13 + ph) * amp + sin(t*0.063 + ph*1.7) * amp * 0.4;
simDY = cos(t*0.105 + ph*1.3) * amp + cos(t*0.048 + ph*0.9) * amp * 0.35;
```

深さ別振幅:

```
depth=0  : (8  + nodeDrift*22) * windMul          幹直下 〜30px
depth≥1  : (25 + nodeDrift*75) * windMul * boost  葉 〜100px+
          boost = 1 + min(depth-1, 2) * swayDepth * 0.45
windMul  = nodeShimmer * 2.0
```

### 重なり防止(hard separation)

ノード・幹の両方で同じアルゴリズム(最小距離を下回っていれば半々で押し離す、2反復)を適用する。

**ノード** (`js/nodesim.js`): 位置は **`_restX + simDX`** を使う
(`n._x` には前フレームの simDX が既に畳み込まれているため使うと二重加算になる)。
```
minD  = (ra + rb) * 1.06         半径は n._r(描画半径)
push  = min(40, (minD - d) / 2)  1反復の上限 40px
simDX を ±push で直接上書き
```

**幹** (`js/liveforest.js`): 位置は `tree.x + _swayX`、半径は `trunkRadiusFor()`。
```
minD  = (ra + rb) * 1.10         幹は余白を厚めに
push  = min(50, (minD - d) / 2)  1反復の上限 50px
_swayX を ±push で直接上書き
```

どちらも DB 位置 (`tree.x/y`, `offset_x/y`) は触らない。_sway / simDX を介した視覚補正のみ。

### rest 位置の配置(兄弟重なり予防)

`tree.js` `computeAllPositions` で、兄弟数と最大子半径から必要な `baseLen` を算出:

```
requiredLen = n * maxChildR * 2.3 / (2π * arcFrac)
baseLen     = max(defaultLen, requiredLen)
```

これで**同じ親の兄弟**は rest で重ならない。cross-tree(別樹の葉)は hard separation が対応。

### ドラッグの挙動

1. **mousedown**: `obj._dragging = true` だけ立てる(ベーク処理なし)
2. **mousemove**: `tree.x = origX + worldDx` または `offset_x = origOff + worldDx`
3. tick / nodesim は `_dragging=true` を見て sway 更新をスキップ → **sway 凍結**
4. 表示 = `tree.x + 凍結sway` = マウスに完全追従
5. **mouseup**: `_dragging = false`。sway 再開(小さな位相差のみなのでジャンプなし)

### 管理者パラメータ(ゆらぎタブ)

| key | 効果 |
|---|---|
| `shimmerAmp` | 幹 sway の振幅倍率(×0.25〜×3.0)|
| `shimmerSpeed` | 時間の進みを ×0.4〜×1.6 倍 |
| `nodeShimmer` | ノード sway 全体倍率(×0〜×2)|
| `nodeDrift` | 葉の基本振幅 |
| `nodeSwayDepth` | 深い階層ほど振幅増幅 |

### その他の約束事

- **幹の大きさは名前の長さに関わらず一定**(`TRUNK_BASE_R = 54`、`trunkSize` のみで調整)
- **自分の幹=`#c89566`(warm amber)、他人の幹=`#6f8a7d`(cool sage)**
- **新規枝ノードの初期色は所属する幹の色と同じ**(`trunkColorFor(isSelf)`)
  子ノードは親ノードの色を継承

### 廃止済みの機構

- サイズ脈動(`nodePulseAmp/Speed`) — ゆらぎは位置のみ
- 文言類似による引力(`textAffinity`) — 最小構成では計算しない
- 樹間の累積 drift、類似樹の引力、中心引力 — 全廃(樹間斥力は hard separation に置換)
- ノードの spring / charge / wind velocity / インパルス — 全廃

### 決定論性

幹・ノードの位相はそれぞれ `tree.id` / `node.id + text` から決まるが、
`this.t` はクライアントごとにページ開いた時刻からスタートするため、
**複数ユーザー間で位置は同期しない**。完全同期するなら以下のどちらかが必要:

1. `this.t = (Date.now() - EPOCH) / 1000` にして共通の wall-clock 時計に揃える
2. サーバー側でシムを実行しブロードキャスト(要インフラ追加)

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
