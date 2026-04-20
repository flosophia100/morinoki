# 森(morinoki) v2 実装計画 — Phase 0 + 1

> **エージェント向け:** タスクごとにチェックボックスで進捗管理。`superpowers:executing-plans` または `superpowers:subagent-driven-development` で実行推奨。

**Goal**: v1(単一HTML・ローカル)をv2(Supabase+Vercel、複数ユーザー共有)にリプレース。Phase 0(セットアップ)+ Phase 1(MVP: force無しで動く森)の範囲。

**Architecture**: 静的HTML/CSS/ESM。Supabase(Postgres+Realtime+RPC)がバックエンド、Vercelが静的ホスト。書き込みは全て `security definer` RPC 経由。クライアント側は`js/`配下の責務別モジュール。

**Tech Stack**: Vanilla ESM JavaScript + Canvas 2D / Supabase-js v2 (CDN ESM) / Supabase Postgres / Vercel static / Google Fonts(Shippori Mincho, Klee One)

**Phase 1のスコープ外(後続計画)**: D3 force simulation、realtime同期、アニメーション、時間帯演出、復元メール、モバイル調整、復元キーフロー、他樹詳細ボトムシート

**Phase 1 ゴール**: 招待URLで誰かの森に入り、名前+合言葉で樹を植え、キーワードノードを追加・編集・削除でき、別端末で再アクセスしてDB経由で樹が見える。force無しのランダム配置、手動リロードでOK。

---

## ファイル構成(Phase 1終了時)

```
morinoki/
├── CLAUDE.md                        # v2用に更新 (T9.2)
├── README.md                        # 既存 (企画書、触らない)
├── CONTRIBUTING.md                  # 本文書 (触らない)
├── mori.html                        # 既存 v1 (触らない)
├── reference/wordmap/               # 既存 参考 (触らない)
│
├── index.html                       # T1.1: エントリ画面
├── room.html                        # T7.1: 森ビュー
├── test.html                        # T0.8: 純粋関数の手動テストページ
│
├── js/
│   ├── utils.js                     # T2.1: stringHash / seededRandom / escapeHtml / hex color
│   ├── auth.js                      # T4.1: edit_token のlocalStorage管理
│   ├── supabase.js                  # T3.1: クライアント初期化 + RPCラッパ
│   ├── tree.js                      # T6.1: 樹1本を上空視点でCanvas描画(force無しランダム配置)
│   ├── forest.js                    # T7.2: Canvas/DPR/pan/zoom/描画ループ
│   ├── editor.js                    # T8.1: 植樹モーダル, インラインノードパネル
│   └── app.js                       # T5.1: state store + ルーティング(index/room)
│
├── css/main.css                     # T1.2: 全画面共通スタイル
│
├── supabase/
│   └── migrations/001_init.sql      # T0.3: rooms/trees/nodes + RPC + RLS
│
├── vercel.json                      # T0.2: /r/:slug → /room.html rewrite
└── .env.example                     # T0.4: SUPABASE_URL/ANON_KEY のテンプレ
```

### モジュール責務
- `utils.js`: 純粋関数のみ。DOMもSupabaseも触らない
- `auth.js`: `localStorage`読み書きと `edit_token`の有効性判定だけ
- `supabase.js`: Supabase JSクライアント初期化と RPC メソッドの薄いラッパ
- `tree.js`: 1本の樹を描く純粋関数 `drawTree(ctx, tree, x, y, scale)`
- `forest.js`: キャンバス設定、pan/zoom、描画ループ。データ層は触らない
- `editor.js`: DOMを使ったUIパネル。保存時に`supabase.js`経由で永続化
- `app.js`: ページ判定(index or room)、state、画面初期化ワイヤリング

---

## Phase 0 — セットアップ

### Task 0.1: ディレクトリ骨格作成

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p "C:/Users/fubas/Documents/morinoki/js" "C:/Users/fubas/Documents/morinoki/css" "C:/Users/fubas/Documents/morinoki/supabase/migrations"
```

- [ ] **Step 2: 確認** — `ls` で `js`/`css`/`supabase` が存在

---

### Task 0.2: 空のプレースホルダファイル作成

- [ ] **Step 1: 各ファイルを最小内容で作成**

`js/utils.js` `js/auth.js` `js/supabase.js` `js/tree.js` `js/forest.js` `js/editor.js` `js/app.js` にはそれぞれ:
```js
// <ファイル名> — Phase 1 で実装
export {};
```

`css/main.css`:
```css
/* 森 v2 main stylesheet — T1.2 で実装 */
```

`vercel.json`:
```json
{
  "rewrites": [
    { "source": "/r/:slug", "destination": "/room.html" }
  ]
}
```

---

### Task 0.3: Supabase スキーマ migration

`supabase/migrations/001_init.sql` を作成:

```sql
-- ===== Extensions =====
create extension if not exists pgcrypto;

-- ===== Tables =====
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

-- ===== RLS =====
alter table rooms enable row level security;
alter table trees enable row level security;
alter table nodes enable row level security;

create policy "public read rooms" on rooms for select using (true);
create policy "public read trees" on trees for select using (true);
create policy "public read nodes" on nodes for select using (true);
-- 書き込みpolicyなし → RPC security definer経由のみ

-- ===== 前提 =====
-- Supabase Dashboard > Project Settings > API の JWT Secret を取得し、SQL Editorで一度だけ:
--   alter database postgres set app.settings.jwt_secret = '<JWT_SECRET>';

-- ===== helper: sign_edit_token (HS256 JWT) =====
create or replace function sign_edit_token(p_tree_id uuid)
returns text language plpgsql security definer as $$
declare
  v_secret text := current_setting('app.settings.jwt_secret', true);
  v_header text := encode(convert_to('{"alg":"HS256","typ":"JWT"}', 'UTF8'), 'base64');
  v_payload text := encode(convert_to(
    json_build_object('tree_id', p_tree_id, 'exp', extract(epoch from now())::int + 7*24*3600)::text, 'UTF8'), 'base64');
  v_unsigned text;
  v_sig text;
begin
  if coalesce(v_secret,'') = '' then raise exception 'jwt_secret not configured'; end if;
  v_header := replace(replace(replace(v_header,'+','-'),'/','_'),'=','');
  v_payload := replace(replace(replace(v_payload,'+','-'),'/','_'),'=','');
  v_unsigned := v_header || '.' || v_payload;
  v_sig := encode(hmac(v_unsigned, v_secret, 'sha256'), 'base64');
  v_sig := replace(replace(replace(v_sig,'+','-'),'/','_'),'=','');
  return v_unsigned || '.' || v_sig;
end;
$$;

-- ===== helper: verify_edit_token =====
create or replace function verify_edit_token(p_token text)
returns uuid language plpgsql security definer as $$
declare
  parts text[];
  v_secret text := current_setting('app.settings.jwt_secret', true);
  v_unsigned text; v_expected text; v_payload jsonb; v_pad text;
begin
  parts := string_to_array(p_token, '.');
  if array_length(parts,1) <> 3 then raise exception 'bad token'; end if;
  v_unsigned := parts[1] || '.' || parts[2];
  v_expected := encode(hmac(v_unsigned, v_secret, 'sha256'), 'base64');
  v_expected := replace(replace(replace(v_expected,'+','-'),'/','_'),'=','');
  if v_expected <> parts[3] then raise exception 'bad signature'; end if;
  v_pad := rpad(replace(replace(parts[2],'-','+'),'_','/'), ((length(parts[2])+3)/4)*4, '=');
  v_payload := convert_from(decode(v_pad, 'base64'), 'UTF8')::jsonb;
  if (v_payload->>'exp')::int < extract(epoch from now())::int then raise exception 'token expired'; end if;
  return (v_payload->>'tree_id')::uuid;
end;
$$;

-- ===== RPC: create_room =====
create or replace function create_room(p_slug text, p_name text)
returns rooms language plpgsql security definer as $$
declare r rooms;
begin
  if p_slug is null or length(p_slug) < 3 then raise exception 'slug too short'; end if;
  insert into rooms(slug, name) values (p_slug, p_name) returning * into r;
  return r;
end;
$$;

-- ===== RPC: create_tree =====
create or replace function create_tree(p_room_slug text, p_name text, p_passcode text, p_email text)
returns table(tree_id uuid, recovery_key text)
language plpgsql security definer as $$
declare
  v_room_id uuid; v_recovery text; v_seed bigint; v_tree_id uuid;
begin
  if coalesce(length(p_passcode),0) < 4 then raise exception 'passcode too short'; end if;
  select id into v_room_id from rooms where slug = p_room_slug;
  if v_room_id is null then raise exception 'room not found'; end if;
  v_recovery := encode(gen_random_bytes(8), 'hex');
  v_seed := (abs(hashtext(p_name || v_recovery)))::bigint;
  insert into trees(room_id, name, passcode_hash, recovery_key_hash, recovery_email, seed)
    values (v_room_id, p_name, crypt(p_passcode, gen_salt('bf')),
            crypt(v_recovery, gen_salt('bf')), nullif(p_email,''), v_seed)
    returning id into v_tree_id;
  return query select v_tree_id, v_recovery;
end;
$$;

-- ===== RPC: auth_tree =====
create or replace function auth_tree(p_tree_id uuid, p_secret text)
returns text language plpgsql security definer as $$
declare v trees;
begin
  select * into v from trees where id = p_tree_id;
  if v is null then raise exception 'tree not found'; end if;
  if v.passcode_hash = crypt(p_secret, v.passcode_hash)
     or v.recovery_key_hash = crypt(p_secret, v.recovery_key_hash) then
    return sign_edit_token(p_tree_id);
  end if;
  raise exception 'unauthorized';
end;
$$;

-- ===== RPC: upsert_node =====
create or replace function upsert_node(
  p_edit_token text, p_tree_id uuid, p_id uuid,
  p_text text, p_size smallint, p_color text, p_ord smallint
) returns nodes language plpgsql security definer as $$
declare v_tid uuid; r nodes;
begin
  v_tid := verify_edit_token(p_edit_token);
  if v_tid <> p_tree_id then raise exception 'token/tree mismatch'; end if;
  if p_id is null then
    insert into nodes(tree_id, text, size, color, ord)
      values (p_tree_id, p_text, coalesce(p_size,3), coalesce(p_color,'#5a6b3e'), coalesce(p_ord,0))
      returning * into r;
  else
    update nodes set text=p_text, size=coalesce(p_size,size),
      color=coalesce(p_color,color), ord=coalesce(p_ord,ord)
      where id = p_id and tree_id = p_tree_id returning * into r;
    if r is null then raise exception 'node not found'; end if;
  end if;
  update trees set updated_at = now() where id = p_tree_id;
  return r;
end;
$$;

-- ===== RPC: delete_node =====
create or replace function delete_node(p_edit_token text, p_node_id uuid)
returns void language plpgsql security definer as $$
declare v_tid uuid; v_node_tree uuid;
begin
  v_tid := verify_edit_token(p_edit_token);
  select tree_id into v_node_tree from nodes where id = p_node_id;
  if v_node_tree is null then raise exception 'node not found'; end if;
  if v_node_tree <> v_tid then raise exception 'token/tree mismatch'; end if;
  delete from nodes where id = p_node_id;
  update trees set updated_at = now() where id = v_tid;
end;
$$;
```

- [ ] **ユーザー作業**: Supabase プロジェクトを作成しSQL Editorで上記を実行。JWT Secretを `app.settings.jwt_secret` にセット。

---

### Task 0.4: `.env.example`

```
# Supabase プロジェクトの値を埋めてください
SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
※ 静的配信のため、実際の値はindex.html/room.htmlの`window.SUPABASE_CONFIG`に直接埋める。anonキーは公開前提でRLSで守る。

---

## Phase 1 — MVP

### Task 1.1: index.html

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>森 — 新しい森をつくる</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;700&family=Klee+One:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/main.css">
<script>
window.SUPABASE_CONFIG = {
  url: 'https://xxxxxxxxxxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
</script>
</head>
<body class="page-index">
  <main class="entry">
    <h1 class="title-mark">森</h1>
    <p class="subtitle">ひとりが一本の樹になり、<br>みんなでひとつの森をそだてる。</p>

    <form id="create-form" class="create-form">
      <label>森の名前
        <input type="text" id="forest-name" maxlength="40" required placeholder="3年A組の森">
      </label>
      <label>URL(半角英数字とハイフン、3文字以上)
        <input type="text" id="forest-slug" maxlength="40" required pattern="[a-z0-9-]{3,40}" placeholder="3a-forest">
      </label>
      <button type="submit" class="btn-primary">森をつくる</button>
    </form>

    <div id="created" class="created hidden">
      <p>森ができました。このURLを仲間と共有してください:</p>
      <code id="created-url"></code>
      <div class="created-actions">
        <button id="copy-url" class="btn-secondary">URLをコピー</button>
        <a id="open-forest" class="btn-primary" href="#">森に入る →</a>
      </div>
    </div>

    <p id="error" class="error hidden"></p>
  </main>

  <script type="module" src="js/app.js"></script>
</body>
</html>
```

---

### Task 1.2: css/main.css

```css
* { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

:root {
  --paper: #f4ede0; --paper-dark: #e8dcc6; --ink: #1f1a15; --ink-soft: #4a3f32;
  --moss: #5a6b3e; --moss-deep: #3a4828; --bark: #6b4a2b; --root: #8b6a4a;
  --gold: #c49a3e; --bud: #d4694a; --mist: rgba(244, 237, 224, 0.85);
}

html, body { height: 100%; font-family: 'Shippori Mincho', serif; color: var(--ink); background: var(--paper); }

body.page-index {
  display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem 1.25rem;
  background:
    radial-gradient(ellipse at 20% 0%, rgba(196, 154, 62, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(90, 107, 62, 0.12) 0%, transparent 60%),
    linear-gradient(180deg, #f6f0e2 0%, #ede3cf 100%);
}

.entry { max-width: 420px; width: 100%; text-align: center; }
.title-mark { font-size: clamp(4rem, 18vw, 7rem); color: var(--moss-deep); letter-spacing: 0.15em; line-height: 1; margin-bottom: 0.5rem; }
.subtitle { font-family: 'Klee One', serif; font-size: 0.95rem; color: var(--ink-soft); line-height: 1.9; margin-bottom: 2.5rem; }

.create-form { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; text-align: left; }
.create-form label { font-family: 'Klee One', serif; font-size: 0.85rem; color: var(--ink-soft); display: flex; flex-direction: column; gap: 0.4rem; }
.create-form input {
  padding: 0.7rem 0.9rem; font-family: 'Shippori Mincho', serif; font-size: 1rem;
  border: 1px solid rgba(74, 63, 50, 0.25); background: white; color: var(--ink); outline: none;
}
.create-form input:focus { border-color: var(--moss); }

.btn-primary {
  font-family: 'Shippori Mincho', serif; font-size: 1rem; padding: 0.9rem 2rem;
  background: var(--moss-deep); color: var(--paper); border: none;
  letter-spacing: 0.2em; cursor: pointer; display: inline-block; text-decoration: none; text-align: center;
}
.btn-primary:hover { background: var(--ink); }
.btn-secondary {
  font-family: 'Shippori Mincho', serif; font-size: 0.9rem; padding: 0.7rem 1.2rem;
  background: transparent; color: var(--ink-soft); border: 1px solid var(--ink-soft);
  letter-spacing: 0.15em; cursor: pointer;
}

.created { margin-top: 1.5rem; padding: 1rem; background: rgba(255,252,244,0.9); border: 1px solid rgba(90,107,62,0.2); }
.created code { display: block; margin: 0.5rem 0 1rem; padding: 0.5rem; background: var(--paper-dark); font-family: 'Klee One', monospace; word-break: break-all; font-size: 0.85rem; }
.created-actions { display: flex; gap: 0.5rem; justify-content: center; }

.error { margin-top: 1rem; padding: 0.7rem; color: var(--bud); background: rgba(212,105,74,0.08); border: 1px solid var(--bud); font-size: 0.88rem; }
.hidden { display: none !important; }

/* === Room画面 === */
body.page-room { overflow: hidden; background: #ede3cf; }
.room-header, .room-footer {
  position: fixed; left: 0; right: 0; z-index: 10;
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.9rem 1.1rem; pointer-events: none;
}
.room-header { top: 0; background: linear-gradient(180deg, var(--mist) 0%, transparent 100%); }
.room-footer { bottom: 0; background: linear-gradient(0deg, var(--mist) 0%, transparent 100%); justify-content: center; gap: 0.6rem; }
.room-header > *, .room-footer > * { pointer-events: auto; }
.forest-name { font-size: 1.1rem; color: var(--moss-deep); letter-spacing: 0.2em; }
.forest-count { font-family: 'Klee One', serif; font-size: 0.78rem; color: var(--ink-soft); }
.btn-plant {
  padding: 0.7rem 1.4rem; font-family: 'Shippori Mincho', serif; font-size: 0.9rem;
  background: var(--ink); color: var(--paper); border: none; cursor: pointer; letter-spacing: 0.15em;
}

.forest-container { position: fixed; inset: 0; overflow: hidden; z-index: 1; }
#forest-canvas { display: block; width: 100%; height: 100%; cursor: grab; }
#forest-canvas:active { cursor: grabbing; }

.modal {
  position: fixed; inset: 0; background: rgba(31,26,21,0.55);
  display: flex; align-items: center; justify-content: center; z-index: 20; padding: 1rem;
}
.modal-panel {
  background: var(--paper); padding: 1.5rem 1.3rem;
  width: 100%; max-width: 380px; display: flex; flex-direction: column; gap: 0.8rem;
}
.modal-panel h2 { font-size: 1.3rem; color: var(--moss-deep); letter-spacing: 0.15em; margin-bottom: 0.3rem; }
.modal-panel label { font-family: 'Klee One', serif; font-size: 0.82rem; color: var(--ink-soft); display: flex; flex-direction: column; gap: 0.3rem; }
.modal-panel input { padding: 0.6rem 0.8rem; font-family: 'Shippori Mincho',serif; font-size: 0.95rem; border: 1px solid rgba(74,63,50,0.25); background: white; outline: none; }
.modal-panel input:focus { border-color: var(--moss); }
.modal-panel code { padding: 0.7rem; background: var(--paper-dark); font-family: 'Klee One', monospace; font-size: 1.1rem; text-align: center; letter-spacing: 0.1em; }
.modal-panel .hint { font-family: 'Klee One',serif; font-size: 0.82rem; color: var(--ink-soft); line-height: 1.6; }
.modal-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.3rem; }

.node-panel {
  position: fixed; right: 1rem; top: 4rem; width: 260px; max-height: 60vh;
  background: var(--paper); border: 1px solid rgba(90,107,62,0.25); z-index: 15;
  display: flex; flex-direction: column; overflow: hidden;
}
.node-panel header { display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.8rem; border-bottom: 1px solid rgba(74,63,50,0.15); }
.node-panel header span { font-size: 0.95rem; color: var(--moss-deep); letter-spacing: 0.1em; }
.node-panel header button { background: none; border: none; font-size: 1.3rem; cursor: pointer; color: var(--ink-soft); }
.node-add { display: flex; gap: 0.3rem; padding: 0.6rem 0.8rem; }
.node-add input { flex: 1; padding: 0.5rem 0.7rem; font-family: 'Shippori Mincho',serif; font-size: 0.9rem; border: 1px solid rgba(74,63,50,0.25); outline: none; }
.node-add button { padding: 0.5rem 0.8rem; background: var(--ink); color: var(--paper); border: none; cursor: pointer; font-size: 1rem; }
.node-panel ul { list-style: none; overflow-y: auto; padding: 0 0.8rem 0.8rem; }
.node-panel li { padding: 0.4rem 0.5rem; margin-top: 0.3rem; background: rgba(255,255,255,0.7); display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-family: 'Klee One',serif; font-size: 0.88rem; }
.node-panel li .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

.node-edit {
  position: fixed; background: var(--paper); padding: 0.8rem; border: 1px solid rgba(74,63,50,0.2);
  z-index: 25; min-width: 220px; display: flex; flex-direction: column; gap: 0.5rem;
}
.node-edit input { padding: 0.45rem 0.7rem; font-family: 'Shippori Mincho',serif; font-size: 0.92rem; border: 1px solid rgba(74,63,50,0.25); outline: none; }
.size-row { display: flex; gap: 0.2rem; }
.size-row button { flex: 1; padding: 0.4rem 0; font-family: 'Klee One',serif; font-size: 0.78rem; background: transparent; border: 1px solid rgba(74,63,50,0.2); cursor: pointer; }
.size-row button.on { background: var(--moss); color: var(--paper); border-color: var(--moss); }
.color-row { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.color-row button { width: 22px; height: 22px; border-radius: 50%; border: 1px solid rgba(0,0,0,0.15); cursor: pointer; }
.color-row button.on { outline: 2px solid var(--gold); outline-offset: 1px; }
.node-edit-actions { display: flex; gap: 0.4rem; justify-content: space-between; }
.btn-danger {
  padding: 0.5rem 0.9rem; font-family: 'Shippori Mincho',serif; font-size: 0.85rem;
  background: transparent; color: var(--bud); border: 1px solid var(--bud); cursor: pointer;
}
```

---

### Task 2.1: js/utils.js

```js
export function stringHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}

export function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export function isValidSlug(s) {
  return /^[a-z0-9-]{3,40}$/.test(s);
}

export function randomSlug() {
  const adj = ['midori','kigi','koke','yama','tani','sora','tsuchi','hikari'];
  const noun = ['mori','yabu','ne','hara','oka'];
  const pick = a => a[Math.floor(Math.random()*a.length)];
  return pick(adj) + '-' + pick(noun) + '-' + Math.floor(Math.random()*9000+1000);
}
```

---

### Task 0.8: test.html (手動テストランナー)

```html
<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8"><title>test</title>
<style>body{font-family:monospace;padding:1em}.p{color:green}.f{color:#c00}</style>
</head><body>
<h1>tests</h1><div id="out"></div>
<script type="module">
import { stringHash, seededRandom, isValidSlug, randomSlug } from './js/utils.js';
const out = document.getElementById('out');
let fails = 0;
function t(name, fn) {
  try { fn(); out.insertAdjacentHTML('beforeend', `<div class="p">✓ ${name}</div>`); }
  catch(e) { fails++; out.insertAdjacentHTML('beforeend', `<div class="f">✗ ${name}: ${e.message}</div>`); }
}
function eq(a,b,m){ if(a!==b) throw new Error((m||'')+' expected '+b+' got '+a); }
function ok(v,m){ if(!v) throw new Error(m||'expected truthy'); }

t('stringHash deterministic', () => eq(stringHash('abc'), stringHash('abc')));
t('stringHash differs', () => ok(stringHash('abc') !== stringHash('abd')));
t('stringHash positive', () => { ok(stringHash('')>=1); ok(stringHash('x')>=1); });
t('seededRandom deterministic', () => { const a=seededRandom(42),b=seededRandom(42); eq(a(),b()); eq(a(),b()); });
t('isValidSlug accepts', () => { ok(isValidSlug('abc-def')); ok(isValidSlug('3a-forest')); });
t('isValidSlug rejects', () => { ok(!isValidSlug('AB')); ok(!isValidSlug('ab')); ok(!isValidSlug('ab_cd')); });
t('randomSlug valid', () => { for(let i=0;i<20;i++) ok(isValidSlug(randomSlug())); });

out.insertAdjacentHTML('beforeend', `<hr><div>${fails===0?'ALL PASS':'FAILURES: '+fails}</div>`);
</script>
</body></html>
```

- [ ] **テスト実行**: `test.html` をブラウザで開いて `ALL PASS`

---

### Task 3.1: js/supabase.js

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.SUPABASE_CONFIG;
if (!cfg || !cfg.url || !cfg.anonKey) {
  console.warn('SUPABASE_CONFIG is not set. Edit index.html / room.html.');
}

export const supabase = cfg && cfg.url
  ? createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false } })
  : null;

function rpc(name, args) {
  if (!supabase) return Promise.reject(new Error('Supabase not configured'));
  return supabase.rpc(name, args).then(({ data, error }) => {
    if (error) throw new Error(error.message || String(error));
    return data;
  });
}

export const api = {
  createRoom: (slug, name) => rpc('create_room', { p_slug: slug, p_name: name }),
  createTree: (roomSlug, name, passcode, email) =>
    rpc('create_tree', { p_room_slug: roomSlug, p_name: name, p_passcode: passcode, p_email: email || null }),
  authTree: (treeId, secret) =>
    rpc('auth_tree', { p_tree_id: treeId, p_secret: secret }),
  upsertNode: (token, treeId, node) =>
    rpc('upsert_node', {
      p_edit_token: token, p_tree_id: treeId,
      p_id: node.id || null, p_text: node.text,
      p_size: node.size, p_color: node.color, p_ord: node.ord || 0
    }),
  deleteNode: (token, nodeId) =>
    rpc('delete_node', { p_edit_token: token, p_node_id: nodeId }),
  getRoomBySlug: (slug) =>
    supabase.from('rooms').select('*').eq('slug', slug).single()
      .then(({ data, error }) => { if (error) throw error; return data; }),
  getTrees: (roomId) =>
    supabase.from('trees').select('*').eq('room_id', roomId)
      .then(({ data, error }) => { if (error) throw error; return data; }),
  getNodes: (treeIds) =>
    supabase.from('nodes').select('*').in('tree_id', treeIds)
      .then(({ data, error }) => { if (error) throw error; return data; }),
};
```

---

### Task 4.1: js/auth.js

```js
const KEY_PREFIX = 'mori.session.';

export function saveSession(roomSlug, session) {
  localStorage.setItem(KEY_PREFIX + roomSlug, JSON.stringify(session));
}
export function loadSession(roomSlug) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + roomSlug);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s.editToken || !s.treeId) return null;
    return s;
  } catch { return null; }
}
export function clearSession(roomSlug) {
  localStorage.removeItem(KEY_PREFIX + roomSlug);
}
export function isTokenExpired(token) {
  try {
    const payload = token.split('.')[1];
    const json = JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
    return (json.exp || 0) * 1000 < Date.now();
  } catch { return true; }
}
```

---

### Task 5.1: js/app.js (index部分)

```js
import { api } from './supabase.js';
import { isValidSlug, randomSlug } from './utils.js';

const isIndex = document.body.classList.contains('page-index');
const isRoom = document.body.classList.contains('page-room');

if (isIndex) initIndex();
if (isRoom) initRoom();

function initIndex() {
  const form = document.getElementById('create-form');
  const created = document.getElementById('created');
  const createdUrl = document.getElementById('created-url');
  const openBtn = document.getElementById('open-forest');
  const copyBtn = document.getElementById('copy-url');
  const errBox = document.getElementById('error');
  const slugInput = document.getElementById('forest-slug');

  if (!slugInput.value) slugInput.value = randomSlug();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hidden');
    const name = document.getElementById('forest-name').value.trim();
    const slug = slugInput.value.trim().toLowerCase();
    if (!isValidSlug(slug)) return showError('URLは英小文字・数字・ハイフンで3〜40文字');
    try {
      await api.createRoom(slug, name);
      const url = `${location.origin}/r/${slug}`;
      createdUrl.textContent = url;
      openBtn.href = url;
      created.classList.remove('hidden');
      form.classList.add('hidden');
    } catch (err) { showError(err.message || String(err)); }
  });

  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(createdUrl.textContent);
    copyBtn.textContent = 'コピーしました';
    setTimeout(() => copyBtn.textContent = 'URLをコピー', 1500);
  });
  function showError(msg){ errBox.textContent = msg; errBox.classList.remove('hidden'); }
}

async function initRoom() {
  const { createForest, layoutRandom } = await import('./forest.js');
  const { openPlantModal, openNodePanel } = await import('./editor.js');
  const { loadSession, isTokenExpired, clearSession } = await import('./auth.js');

  const slug = location.pathname.match(/\/r\/([^\/]+)/)?.[1] || new URLSearchParams(location.search).get('slug');
  if (!slug) return alert('ルームが指定されていません');

  const state = { room: null, trees: [], session: null, selfTreeId: null,
                  onTreeTap: null, onEmptyTap: null, view: null };

  try { state.room = await api.getRoomBySlug(slug); }
  catch { return alert('森が見つかりません: ' + slug); }

  document.getElementById('forest-name').textContent = state.room.name || state.room.slug;

  const sess = loadSession(slug);
  if (sess && !isTokenExpired(sess.editToken)) {
    state.session = sess; state.selfTreeId = sess.treeId;
  } else if (sess) {
    clearSession(slug);
  }

  await reload();
  const canvas = document.getElementById('forest-canvas');
  const forest = createForest(canvas, state);

  state.onTreeTap = (tree) => {
    if (state.session && tree.id === state.selfTreeId) {
      openNodePanel(state, tree, () => forest.render());
    } else {
      alert(`${tree.name}さん\nキーワード: ${(tree.nodes||[]).map(n=>n.text).join(' / ') || '(まだ)'}`);
    }
  };
  state.onEmptyTap = () => {
    if (!state.session) {
      openPlantModal(state, async () => {
        state.session = loadSession(slug);
        state.selfTreeId = state.session.treeId;
        await reload();
        forest.render();
        const mine = state.trees.find(t => t.id === state.selfTreeId);
        if (mine) openNodePanel(state, mine, () => forest.render());
      });
    }
  };

  document.getElementById('plant-btn').addEventListener('click', () => state.onEmptyTap({x:0,y:0}));
  forest.render();

  async function reload() {
    const trees = await api.getTrees(state.room.id);
    const ids = trees.map(t => t.id);
    const nodes = ids.length ? await api.getNodes(ids) : [];
    const byTree = {};
    nodes.forEach(n => (byTree[n.tree_id] ||= []).push(n));
    trees.forEach(t => { t.nodes = (byTree[t.id] || []).sort((a,b) => a.ord - b.ord); });
    state.trees = trees;
    layoutRandom(state.trees);
    document.getElementById('forest-count').textContent = `${trees.length}本の樹`;
  }
}
```

---

### Task 6.1: js/tree.js (上空視点描画)

```js
import { seededRandom } from './utils.js';

export function drawTree(ctx, tree, cx, cy, scale = 1.0, opts = {}) {
  const { highlight = false } = opts;
  const rng = seededRandom(Number(tree.seed) || 1);
  const nodes = tree.nodes || [];
  const baseRadius = 50 * scale;
  const radius = baseRadius + nodes.length * 3 * scale;

  // 地面の影
  ctx.save();
  ctx.fillStyle = 'rgba(90, 70, 40, 0.08)';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 5, radius * 1.1, radius * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // canopy本体
  ctx.save();
  ctx.fillStyle = 'rgba(90, 107, 62, 0.25)';
  ctx.beginPath();
  const blobs = 6 + Math.floor(rng() * 4);
  for (let i = 0; i < blobs; i++) {
    const a = (Math.PI * 2 * i) / blobs + rng() * 0.3;
    const r = radius * (0.7 + rng() * 0.3);
    const x = cx + Math.cos(a) * r * 0.3;
    const y = cy + Math.sin(a) * r * 0.3;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();

  if (highlight) {
    ctx.save();
    ctx.strokeStyle = 'rgba(196, 154, 62, 0.55)';
    ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  // 葉ノード
  nodes.forEach((n, i) => {
    const a = (Math.PI * 2 * i) / Math.max(1, nodes.length) + rng() * 0.15;
    const r = radius * 0.75 * (0.6 + rng() * 0.4);
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    const nr = (4 + (n.size || 3) * 2) * scale;
    ctx.fillStyle = n.color || '#5a6b3e';
    ctx.beginPath(); ctx.arc(x, y, nr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(31, 26, 21, 0.25)'; ctx.lineWidth = 0.8; ctx.stroke();
    n._x = x; n._y = y; n._r = nr;
  });

  // 名前ラベル
  ctx.save();
  ctx.fillStyle = 'rgba(244, 237, 224, 0.85)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${14 * scale}px 'Shippori Mincho', serif`;
  const lw = ctx.measureText(tree.name).width + 10;
  ctx.fillRect(cx - lw/2, cy - 10*scale, lw, 20*scale);
  ctx.fillStyle = 'rgba(58, 72, 40, 1)';
  ctx.fillText(tree.name, cx, cy);
  ctx.restore();

  return { radius };
}
```

---

### Task 7.1: room.html

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>森</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;700&family=Klee+One:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/main.css">
<script>
window.SUPABASE_CONFIG = {
  url: 'https://xxxxxxxxxxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
</script>
</head>
<body class="page-room">

<header class="room-header">
  <span id="forest-name" class="forest-name">森</span>
  <span id="forest-count" class="forest-count">0本の樹</span>
</header>

<div class="forest-container">
  <canvas id="forest-canvas"></canvas>
</div>

<footer class="room-footer">
  <button id="plant-btn" class="btn-plant">+ 樹を植える</button>
</footer>

<div id="plant-modal" class="modal hidden">
  <div class="modal-panel">
    <h2>樹を植える</h2>
    <label>名前 <input id="plant-name" type="text" maxlength="20" required></label>
    <label>合言葉(4〜10桁) <input id="plant-pass" type="password" minlength="4" maxlength="10" required></label>
    <label>合言葉(確認) <input id="plant-pass2" type="password" minlength="4" maxlength="10" required></label>
    <label>メール(任意・復元用) <input id="plant-email" type="email"></label>
    <div class="modal-actions">
      <button id="plant-cancel" class="btn-secondary">キャンセル</button>
      <button id="plant-submit" class="btn-primary">植える</button>
    </div>
    <p id="plant-error" class="error hidden"></p>
  </div>
</div>

<div id="recovery-modal" class="modal hidden">
  <div class="modal-panel">
    <h2>復元キー</h2>
    <p class="hint">合言葉を忘れたときに使います。いま必ず控えてください(この画面でしか表示されません)。</p>
    <code id="recovery-key"></code>
    <div class="modal-actions">
      <button id="recovery-copy" class="btn-secondary">コピー</button>
      <button id="recovery-ok" class="btn-primary">保存した</button>
    </div>
  </div>
</div>

<aside id="node-panel" class="node-panel hidden">
  <header>
    <span id="node-panel-name">-</span>
    <button id="node-panel-close">×</button>
  </header>
  <div class="node-add">
    <input id="node-input" type="text" placeholder="キーワード" maxlength="20">
    <button id="node-add-btn">＋</button>
  </div>
  <ul id="node-list"></ul>
</aside>

<div id="node-edit" class="node-edit hidden">
  <input id="node-edit-text" type="text" maxlength="20">
  <div class="size-row">
    <button data-size="1">XS</button><button data-size="2">S</button>
    <button data-size="3">M</button><button data-size="4">L</button><button data-size="5">XL</button>
  </div>
  <div class="color-row" id="color-row"></div>
  <div class="node-edit-actions">
    <button id="node-edit-delete" class="btn-danger">削除</button>
    <button id="node-edit-save" class="btn-primary">保存</button>
  </div>
</div>

<script type="module" src="js/app.js"></script>
</body>
</html>
```

---

### Task 7.2: js/forest.js

```js
import { drawTree } from './tree.js';
import { seededRandom } from './utils.js';

export function layoutRandom(trees) {
  trees.forEach((t) => {
    if (t.x == null || t.y == null || (Number(t.x) === 0 && Number(t.y) === 0)) {
      const rng = seededRandom(Number(t.seed) || 1);
      t.x = (rng() - 0.5) * 1000;
      t.y = (rng() - 0.5) * 1000;
    } else {
      t.x = Number(t.x); t.y = Number(t.y);
    }
  });
}

export function createForest(canvas, state) {
  const ctx = canvas.getContext('2d');
  let dpr = 1, W = 0, H = 0;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    W = rect.width; H = rect.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!state.view) state.view = { ox: W/2, oy: H/2, scale: 1 };
  }
  resize();
  window.addEventListener('resize', () => { resize(); render(); });

  let drag = null;
  function pt(e) {
    const r = canvas.getBoundingClientRect();
    const src = e.touches?.[0] || e.changedTouches?.[0] || e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  }
  function onDown(e){ const p = pt(e); drag = { start: p, last: p, moved: 0 }; }
  function onMove(e){
    if (!drag) return;
    const p = pt(e);
    const dx = p.x - drag.last.x, dy = p.y - drag.last.y;
    state.view.ox += dx; state.view.oy += dy;
    drag.last = p; drag.moved += Math.abs(dx) + Math.abs(dy);
    render();
  }
  function onUp(){ /* drag cleared on click handler */ }
  function onWheel(e){
    e.preventDefault();
    const p = pt(e);
    zoomAt(p.x, p.y, e.deltaY > 0 ? 0.9 : 1.1);
    render();
  }
  function zoomAt(px, py, factor) {
    const s = Math.max(0.3, Math.min(3, state.view.scale * factor));
    state.view.ox = px - (px - state.view.ox) * (s / state.view.scale);
    state.view.oy = py - (py - state.view.oy) * (s / state.view.scale);
    state.view.scale = s;
  }
  function onClick(e) {
    const wasDrag = drag && drag.moved > 6;
    const p = pt(e);
    drag = null;
    if (wasDrag) return;
    const world = screenToWorld(p.x, p.y);
    const hit = (state.trees || []).slice().reverse().find(t => {
      const dx = world.x - t.x, dy = world.y - t.y;
      const r = 60 + (t.nodes?.length || 0) * 3;
      return dx*dx + dy*dy < r*r;
    });
    if (hit && state.onTreeTap) state.onTreeTap(hit);
    else if (state.onEmptyTap) state.onEmptyTap(world);
  }
  function screenToWorld(x, y) {
    return { x: (x - state.view.ox) / state.view.scale, y: (y - state.view.oy) / state.view.scale };
  }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
  canvas.addEventListener('touchend', (e) => { onUp(e); onClick(e); });
  canvas.addEventListener('click', onClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function render() {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#f2ead4'); bg.addColorStop(1, '#e2d4b5');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(state.view.ox, state.view.oy);
    ctx.scale(state.view.scale, state.view.scale);
    (state.trees || []).forEach(t => {
      drawTree(ctx, t, t.x, t.y, 1.0, { highlight: t.id === state.selfTreeId });
    });
    ctx.restore();
  }

  return { render, resize, screenToWorld };
}
```

---

### Task 8.1: js/editor.js

```js
import { api } from './supabase.js';
import { saveSession } from './auth.js';
import { escapeHtml } from './utils.js';

const PALETTE = ['#5a6b3e','#8b6a4a','#c49a3e','#d4694a','#6b4a2b','#3a4828','#b8c18c','#e8a298','#7d8f5a','#a87e55'];

export function openPlantModal(state, onPlanted) {
  const m = document.getElementById('plant-modal');
  const err = document.getElementById('plant-error');
  const name = document.getElementById('plant-name');
  const p1 = document.getElementById('plant-pass');
  const p2 = document.getElementById('plant-pass2');
  const email = document.getElementById('plant-email');
  err.classList.add('hidden');
  name.value = ''; p1.value = ''; p2.value = ''; email.value = '';
  m.classList.remove('hidden');
  name.focus();

  document.getElementById('plant-cancel').onclick = () => m.classList.add('hidden');
  document.getElementById('plant-submit').onclick = async () => {
    err.classList.add('hidden');
    const nm = name.value.trim();
    if (!nm) return showErr('名前を入力してください');
    if (p1.value.length < 4) return showErr('合言葉は4桁以上');
    if (p1.value !== p2.value) return showErr('合言葉が一致しません');
    try {
      const res = await api.createTree(state.room.slug, nm, p1.value, email.value.trim() || null);
      const row = Array.isArray(res) ? res[0] : res;
      const treeId = row.tree_id;
      const recovery = row.recovery_key;
      const token = await api.authTree(treeId, p1.value);
      saveSession(state.room.slug, { treeId, editToken: token, treeName: nm });
      m.classList.add('hidden');
      showRecoveryModal(recovery, () => onPlanted({ treeId, editToken: token, treeName: nm }));
    } catch (e) { showErr(e.message || String(e)); }
  };
  function showErr(msg){ err.textContent = msg; err.classList.remove('hidden'); }
}

function showRecoveryModal(key, onClose) {
  const m = document.getElementById('recovery-modal');
  document.getElementById('recovery-key').textContent = key;
  m.classList.remove('hidden');
  document.getElementById('recovery-copy').onclick = async () => {
    await navigator.clipboard.writeText(key);
    document.getElementById('recovery-copy').textContent = 'コピーしました';
  };
  document.getElementById('recovery-ok').onclick = () => { m.classList.add('hidden'); onClose && onClose(); };
}

export function openNodePanel(state, tree, onChange) {
  const panel = document.getElementById('node-panel');
  document.getElementById('node-panel-name').textContent = tree.name;
  renderList();
  panel.classList.remove('hidden');

  document.getElementById('node-panel-close').onclick = () => panel.classList.add('hidden');
  document.getElementById('node-add-btn').onclick = addOne;
  const input = document.getElementById('node-input');
  input.value = ''; input.focus();
  input.onkeydown = (e) => { if (e.key === 'Enter') addOne(); };

  async function addOne() {
    const txt = input.value.trim();
    if (!txt) return;
    const saved = await api.upsertNode(state.session.editToken, tree.id, {
      text: txt, size: 3, color: PALETTE[0], ord: (tree.nodes||[]).length
    });
    tree.nodes = tree.nodes || [];
    tree.nodes.push(saved);
    input.value = '';
    renderList();
    onChange && onChange();
  }

  function renderList() {
    const ul = document.getElementById('node-list');
    ul.innerHTML = (tree.nodes || []).map((n, i) =>
      `<li data-idx="${i}"><span class="dot" style="background:${n.color}"></span>${escapeHtml(n.text)}</li>`
    ).join('');
    ul.querySelectorAll('li').forEach(li => {
      li.onclick = () => openNodeEdit(state, tree, Number(li.dataset.idx), renderList, onChange);
    });
  }
}

function openNodeEdit(state, tree, idx, rerender, onChange) {
  const n = tree.nodes[idx];
  const box = document.getElementById('node-edit');
  const txt = document.getElementById('node-edit-text');
  txt.value = n.text;

  box.querySelectorAll('.size-row button').forEach(b => {
    b.classList.toggle('on', Number(b.dataset.size) === n.size);
    b.onclick = () => {
      box.querySelectorAll('.size-row button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    };
  });

  const cr = document.getElementById('color-row');
  cr.innerHTML = PALETTE.map(c => `<button data-color="${c}" style="background:${c}"></button>`).join('');
  cr.querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.color === n.color);
    b.onclick = () => {
      cr.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    };
  });

  box.style.left = '50%'; box.style.top = '50%'; box.style.transform = 'translate(-50%,-50%)';
  box.classList.remove('hidden');

  document.getElementById('node-edit-save').onclick = async () => {
    const newSize = Number(box.querySelector('.size-row button.on')?.dataset.size || n.size);
    const newColor = cr.querySelector('button.on')?.dataset.color || n.color;
    const newText = txt.value.trim();
    if (!newText) return;
    const saved = await api.upsertNode(state.session.editToken, tree.id, {
      id: n.id, text: newText, size: newSize, color: newColor, ord: n.ord
    });
    tree.nodes[idx] = saved;
    box.classList.add('hidden');
    rerender(); onChange && onChange();
  };
  document.getElementById('node-edit-delete').onclick = async () => {
    await api.deleteNode(state.session.editToken, n.id);
    tree.nodes.splice(idx, 1);
    box.classList.add('hidden');
    rerender(); onChange && onChange();
  };
}
```

---

### Task 9.2: CLAUDE.md に v2 移行注記を追加

CLAUDE.md の **先頭**(1行目)に以下を挿入(既存の内容は残す):
```markdown
> **注記(2026-04-19)**: このCLAUDE.mdはv1(`mori.html`)時点の記述です。v2への改良企画と実装計画は`README.md`と`CONTRIBUTING.md`にあります。v2実装完了までは両方を参照してください。

---
```

---

### Task 10.1: エンドツーエンド手動確認

1. Supabaseで `001_init.sql` 適用 + `alter database postgres set app.settings.jwt_secret = '<JWT_SECRET>'`
2. `index.html` と `room.html` の `window.SUPABASE_CONFIG` を実値で埋める
3. ローカル配信: `npx http-server "C:/Users/fubas/Documents/morinoki" -p 8080`
4. `http://localhost:8080/test.html` → `ALL PASS`
5. `http://localhost:8080/index.html` で森を作り、URLを取得
6. URLに遷移 → `+ 樹を植える` → 合言葉入力 → 復元キーをコピー → キーワードを2〜3個追加
7. シークレットウィンドウで同URLを開くと樹が閲覧できる(編集はできない)
8. 元のブラウザをリロード → 自分の樹はハイライトされ、再度合言葉なしで編集できる

---

## Phase 1 完了基準

- `test.html`: ALL PASS
- 森の作成 → URL取得
- 植樹 → 合言葉 + 復元キー表示
- ノードCRUD(テキスト・サイズ・色)
- リロード後も永続化されている
- 別ブラウザから閲覧可能

## 後続(別計画)

- Phase 2: `d3-force` 導入、`alphaDecay(0)` 常時稼働、幹の弱バネ、枝link、類似ノード引力、パーリンノイズ風、成長アニメ、Supabase Realtime購読
- Phase 3: 時間帯演出、他樹ボトムシート、復元キー/メール復元、QR
- Phase 4: 主催者ダッシュボード、モバイル最適化、エラーUX、60fpsパフォ

---

# 認証・権限モデル再設計(2026-04-21 確定仕様)

> **ステータス**: 仕様確定。実装計画を本ドキュメント後半に記述。
> **Q8(ユーザー管理の範囲)のみ要最終確認**。下記「未確定」参照。

## 確定事項

| Q | 項目 | 決定 |
|---|---|---|
| Q1 | 管理者単位 | **グローバル1アカウント** |
| Q2 | 管理者URL | **`/admin5002` 一本化** |
| Q3 | index.html | **削除**(ルートは404に) |
| Q4 | 既存の森 | **全削除** |
| Q5 | 合言葉/メール変更の確認メール | **両方**(新宛:承認 + 現宛:通知) |
| Q6 | 合言葉忘れリカバリ | **再設定リンクメール** |
| Q7 | 背景・ギミック管理 | **時間帯配色 + 季節固定 + 鳥頻度 + 背景森影**(提案全項目) |
| Q8 | ユーザー管理(要最終確認) | **一覧 / 強制削除 / 合言葉リセット(管理者発行) / メール変更(管理者権限)** の4つを想定 |

---

## 全体像

### アクターと動線

1. **グローバル管理者**(1アカウント)
   - `/admin5002` にアクセス → ID+合言葉 → 管理者トークン発行
   - できること: 森の作成/削除、各森のユーザー管理、デザイン管理、ゆらぎ管理、背景・ギミック管理

2. **一般ユーザー**(幹の所有者)
   - 森の URL `/r/<slug>` にアクセス → 「ログイン」or「新規作成」を選択
   - 新規作成: ニックネーム+合言葉+メール → 確認メール → リンククリックで幹が生える
   - 合言葉/メール変更は都度メール認証
   - 合言葉忘れ → メール宛に再設定リンク → 新合言葉入力

3. **匿名閲覧者**
   - 森の URL にアクセス → そのまま閲覧可能(編集不可)

### 廃止するもの
- `index.html` とトップページ
- `rooms.admin_passcode_hash`(森ごと管理者 → グローバル管理者に移行)
- `trees.recovery_key_hash`(復元キー文字列を廃止)
- `auth_tree` RPC(復元キー認証)
- 既存の全ての森(DB 上の `rooms` 全行)

### 新規作成・変更するもの
- `admin5002.html` — 管理者ログイン+ダッシュボード
- `admins` テーブル(グローバル管理者)
- `pending_credential_change` テーブル(合言葉・メール変更の保留)
- `rooms.ambience` jsonb カラム(背景ギミック設定)
- 各 RPC の admin token 検証ロジックをグローバル化

---

## ファイル構成(変更後)

```
morinoki/
├── admin5002.html                  # [新] 管理者ログイン+ダッシュボード
├── room.html                       # [変] 認証フローから復元キー除去
├── index.html                      # [削除]
├── css/main.css                    # [変] admin5002用スタイル追加
├── js/
│   ├── app.js                      # [変] admin5002の判定+ダッシュボード初期化
│   ├── admin.js                    # [新] 管理者ダッシュボードのロジック
│   ├── supabase.js                 # [変] 新RPCラッパー追加、古いものを削除
│   ├── editor.js                   # [変] 復元キー経路削除、資格変更フロー
│   ├── atmosphere.js               # [変] rooms.ambience.timeKeyframes を読む
│   ├── critters.js                 # [変] rooms.ambience.birdFreq を読む
│   └── ...
├── supabase/migrations/
│   ├── 015_global_admins.sql       # [新] admins テーブル、admin token 更新、create_room を admin-only に
│   ├── 016_drop_recovery_key.sql   # [新] trees.recovery_key_hash 削除、auth_tree削除、login_tree/request_passcode_reset 修正
│   ├── 017_pending_credential.sql  # [新] 合言葉/メール変更のメール認証化
│   ├── 018_ambience.sql            # [新] rooms.ambience jsonb
│   └── 019_wipe_existing.sql       # [新] 既存の全森削除(最後に実行)
└── robots.txt                      # [新] /admin5002 を noindex
```

---

## Phase 1: グローバル管理者+森作成制限

**目的**: `admin5002` URL でグローバル管理者がログインでき、森の作成/削除ができるようになる。一般ユーザーの森作成経路を塞ぐ。

### Migration 015_global_admins.sql

```sql
-- admins テーブル
create table public.admins (
  id uuid primary key default gen_random_uuid(),
  login_id text unique not null,
  passcode_hash text not null,
  created_at timestamptz default now()
);
alter table public.admins enable row level security;

-- sign_admin_token 差し替え: admin_id を payload に
create or replace function public.sign_admin_token(p_admin_id uuid)
returns text ...  -- 既存と同じ JWT だが payload に admin_id
  
-- verify_admin_token 差し替え: admin_id を返す(旧版は room_id を返していた)
create or replace function public.verify_admin_token(p_token text)
returns uuid ...

-- admin_login 差し替え: login_id + passcode で admin_id の token を返す
create or replace function public.admin_login(p_login_id text, p_passcode text)
returns text ...

-- set_admin_credentials: 管理者自身が自分のID・合言葉を更新
create or replace function public.set_admin_credentials(
  p_current_token text, p_new_login_id text, p_new_passcode text
) returns void ...

-- create_room を admin_token 必須に
drop function public.create_room(text, text);
create or replace function public.create_room(
  p_admin_token text, p_slug text, p_name text
) returns public.rooms ...

-- delete_room: 管理者が森を削除(trees+nodes CASCADE)
create or replace function public.delete_room(p_admin_token text, p_slug text)
returns void ...

-- 既存の admin 使う RPC (upsert_node/delete_node/update_tree_position/set_room_design/set_room_admin_passcode)
-- の admin_token 検証部分を、room_id 一致判定から「グローバル管理者なら OK」に変更

-- rooms.admin_passcode_hash を nullable にする(後で drop)
alter table public.rooms alter column admin_passcode_hash drop not null;
```

### フロント
- [ ] `admin5002.html` を作成(新ログイン画面 + ダッシュボード)
  - ログインフォーム: login_id, passcode
  - ログイン後: 森一覧(slug, name, 作成日, ユーザー数)、森作成フォーム、森選択 → 既存の管理画面へ
  - `<meta name="robots" content="noindex, nofollow">` 付与
- [ ] `js/admin.js` を新規(一覧取得、森作成/削除、各森のアドミンリンク `/r/<slug>?admin=1`)
- [ ] `js/supabase.js` に `adminLogin(id, pw)`, `createRoomAsAdmin(token, slug, name)`, `deleteRoom(token, slug)`, `listRooms(token)` を追加
- [ ] `js/app.js` の `initIndex()` を削除、`initAdmin5002()` を新設
- [ ] `index.html` を削除
- [ ] `robots.txt` を作成: `User-agent: *` / `Disallow: /admin5002`

### 初期管理者登録
(マイグレーション後に SQL で1件挿入):
```sql
insert into public.admins(login_id, passcode_hash) values
  ('<任意のID>', extensions.crypt('<合言葉>', extensions.gen_salt('bf')));
```

### Vercel
- 現 `morinoki.vercel.app` の `index.html` が404になる → 問題なし(使う人は管理者のみ)

---

## Phase 2: 復元キー廃止+パスワードリセット link化

### Migration 016_drop_recovery_key.sql

```sql
-- login_tree: recovery_key 経路削除(passcode のみ許可)
create or replace function public.login_tree(p_room_slug, p_name, p_passcode) ...

-- request_passcode_reset: 再設定リンクメールに差し替え
-- pending_credential_change(kind='passcode_reset', token, tree_id, expires_at)
create or replace function public.request_passcode_reset(...) ...

-- verify_passcode_reset: token と新合言葉で実反映
create or replace function public.verify_passcode_reset(
  p_token text, p_new_passcode text
) returns json ...

-- auth_tree 削除
drop function public.auth_tree(uuid, text);

-- trees.recovery_key_hash 削除
alter table public.trees drop column recovery_key_hash;
```

### フロント
- [ ] `editor.js` の「合言葉または復元キー」ラベルを「合言葉」のみに
- [ ] `app.js` の復元キーモーダル表示を、新規登録完了画面に統合(または削除)
- [ ] 「メールで再設定」リンクの動線を URL `/r/<slug>?reset=<token>` に
- [ ] `app.js` の initRoom で `?reset=<token>` を検出 → 新合言葉入力モーダルを表示 → `verify_passcode_reset` を呼ぶ

---

## Phase 3: 合言葉・メール変更のメール認証化

### Migration 017_pending_credential.sql

```sql
create table public.pending_credential_change (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  kind text not null check (kind in ('passcode','email','passcode_reset')),
  new_passcode_hash text,    -- passcode の場合のみ
  new_email text,            -- email の場合のみ
  token text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- request_passcode_change: 新合言葉を受け取り、pending に保存、両方にメール
--   現メール宛: 「変更リクエストが行われました」通知
--   現メール宛に承認リンク(両方送信でOKと仕様決定、現メール=所有者なので合理的)
create or replace function public.request_passcode_change(
  p_edit_token text, p_new_passcode text, p_base_url text
) returns json ...

-- request_email_change: 新メールを受け取り、pending に保存
--   新メール宛: 承認リンク「このアドレスで良ければクリック」
--   現メール宛: 「変更リクエストが行われました」通知
create or replace function public.request_email_change(
  p_edit_token text, p_new_email text, p_base_url text
) returns json ...

-- verify_credential_change: リンクのtokenで実反映
create or replace function public.verify_credential_change(p_token text)
returns json ...

-- update_tree_credentials 削除(直接変更を禁止)
drop function public.update_tree_credentials(text, text, text);
```

### フロント
- [ ] 自分のパネルの合言葉・メール変更フォームを「送信→確認メール待ち」フローに
- [ ] 送信後「確認メールを送りました」表示
- [ ] `app.js` で URL `?credchange=<token>` を検知 → `verify_credential_change` を呼ぶ → 成功トースト

---

## Phase 4: 管理者パネルのタブ化+ユーザー管理

### Migration 018_user_admin_ops.sql

```sql
-- admin_list_users: 指定森のユーザー一覧(管理者のみ)
create or replace function public.admin_list_users(
  p_admin_token text, p_room_slug text
) returns table(tree_id uuid, name text, email text, created_at timestamptz, node_count int) ...

-- admin_delete_user: 指定ユーザー(tree)を削除
create or replace function public.admin_delete_user(
  p_admin_token text, p_tree_id uuid
) returns void ...

-- admin_reset_user_passcode: ランダム合言葉生成→ユーザーのメール宛に「管理者が発行した一時合言葉」を送信
create or replace function public.admin_reset_user_passcode(
  p_admin_token text, p_tree_id uuid
) returns json ...

-- admin_set_user_email: メール直接変更(管理者特権)
create or replace function public.admin_set_user_email(
  p_admin_token text, p_tree_id uuid, p_new_email text
) returns void ...
```

### フロント
- [ ] `editor.js` の管理者パネルを**タブ化**: ユーザー管理 / デザイン / ゆらぎ / 背景ギミック / ツール
- [ ] ユーザー管理タブ: 一覧、行クリックで詳細、削除ボタン、合言葉リセット、メール変更
- [ ] デザインタブ: 既存の9項目スライダー
- [ ] ゆらぎタブ: 既存の3項目スライダー
- [ ] ツールタブ: タイムラプス、CSVエクスポート

---

## Phase 5: 背景・ギミック管理

### Migration 019_ambience.sql

```sql
alter table public.rooms add column if not exists ambience jsonb default '{}'::jsonb;

-- set_room_ambience: 管理者が森の背景・ギミック設定を更新
create or replace function public.set_room_ambience(
  p_admin_token text, p_slug text, p_ambience jsonb
) returns jsonb ...
```

### ambience 構造(初期値)
```json
{
  "timeCurve": "auto",            // "auto" or "night" or "noon" など固定
  "season": "auto",               // "auto" | "spring" | "summer" | "autumn" | "winter"
  "birdFreq": 0.5,                // 0..1 (出現頻度倍率)
  "canopyDensity": 0.5            // 0..1 (背景森影の密度)
}
```

### フロント
- [ ] `js/atmosphere.js`: `atmosphereAt(date, ambience)` に変更、時間帯/季節固定を反映
- [ ] `js/critters.js`: Critters に ambience を渡し、spawn 間隔を ambience.birdFreq で制御
- [ ] `drawBackgroundCanopies`: canopy 数に ambience.canopyDensity を乗算
- [ ] `editor.js` の背景ギミックタブ: 4項目のスライダー+セレクト
- [ ] `app.js` が state.ambience を forest/critters/atmosphere に渡す

---

## Phase 6(最終): 既存データの削除

### Migration 020_wipe_existing.sql

```sql
-- ロールバック不可のため最終実行
delete from public.nodes;
delete from public.pending_registrations;
delete from public.pending_credential_change;
delete from public.mail_outbox;
delete from public.trees;
delete from public.rooms;

-- admins は作成済の初期管理者だけ残す
```

- [ ] Phase 1〜5 が本番で動作確認済みになったあと、Phase 6 を実行
- [ ] その後、管理者が新しい森を作成して運用開始

---

## 実装順序と確認ポイント

| Phase | 完了条件 | ユーザー確認ポイント |
|---|---|---|
| 1 | `/admin5002` でログイン・森作成・森削除ができる | 自分で管理者IDと合言葉を決めて設定 |
| 2 | 復元キー画面が消え、パスワード忘れ→メール→リンクで新合言葉設定できる | テストアカウントでリセットフロー確認 |
| 3 | 合言葉/メール変更がメール認証経由になる | 両方の通知メールが届くこと |
| 4 | 管理者パネルでユーザー一覧・削除・合言葉リセットができる | 管理操作の画面確認 |
| 5 | 管理者が時間帯/季節/鳥頻度/森影を変えると森の見た目が変わる | スライダー操作で即反映 |
| 6 | 既存の森が全削除される | 管理者で新しい森を作り直して運用 |

---

## リスクと注意

- **既存の session**: Phase 6 で全森削除するため、既にログイン中のユーザーは自動的にセッション切れ。これは許容
- **Phase 1 と 6 の間で運用再開する場合**: 既存森は残るがユーザーは新規登録できない期間が発生
- **管理者の初期登録**: `admins` テーブルへの初回 INSERT は SQL Editor から行う。Phase 1 デプロイ直後に私が SQL を実行
- **admin5002 URL の秘匿**: `robots.txt` + `noindex` で検索避け。UA 制限までは不要(秘匿性より単純さ優先)

---

## 実装前の最終確認事項

1. **Q8(ユーザー管理)の確定**: 一覧・削除・合言葉リセット・メール変更の4機能で良いか?(他に必要なものがあれば追加)
2. **管理者の初期 ID と合言葉**: Phase 1 デプロイ直後にこちらで SQL 実行で登録します。どんな ID/合言葉にしますか?(合言葉はメモ推奨。忘れると管理機能が使えなくなります)
3. **Phase 6 の既存森全削除のタイミング**: Phase 1〜5 完了直後? それとも Phase 1 開始前(旧仕様を完全にリセット)?

この3点に回答いただければ、Phase 1 から順次実装を開始します。
