// Supabase DB に migration を流す
// Usage:
//   DATABASE_URL="postgresql://postgres.xxx:<PASSWORD>@aws-0-xxx.pooler.supabase.com:6543/postgres" node run-migration.mjs
//   (または JWT_SECRET=xxx も同時に渡せば app.settings.jwt_secret も設定)
import pg from './node_modules/pg/lib/index.js';
import fs from 'node:fs/promises';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('ERROR: DATABASE_URL env var required');
  console.error('  Supabase: Project Settings > Database > Connection string (URI)');
  process.exit(1);
}
const jwtSecret = process.env.JWT_SECRET;

const sql = await fs.readFile('./supabase/migrations/001_init.sql', 'utf8');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log('Connected to Supabase');

try {
  console.log('Executing migration...');
  await client.query(sql);
  console.log('  OK migration applied');

  if (jwtSecret) {
    console.log('Upserting jwt_secret into _config...');
    await client.query(
      `insert into public._config(key, value) values ('jwt_secret', $1)
       on conflict (key) do update set value = excluded.value`,
      [jwtSecret]
    );
    console.log('  OK');
  }

  // 確認
  console.log('\nVerifying:');
  const rls = await client.query(`
    select tablename, rowsecurity
    from pg_tables
    where schemaname='public' and tablename in ('rooms','trees','nodes')
    order by tablename
  `);
  rls.rows.forEach(r => console.log(`  ${r.tablename}: rowsecurity=${r.rowsecurity}`));

  const fns = await client.query(`
    select proname from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('create_room','create_tree','auth_tree','upsert_node','delete_node','sign_edit_token','verify_edit_token')
    order by proname
  `);
  console.log(`  functions: ${fns.rows.map(r => r.proname).join(', ')}`);

  // smoke test
  console.log('\nSmoke test (create_room):');
  const slug = '_smoke_' + Math.random().toString(36).slice(2,8);
  try {
    const r = await client.query(`select * from public.create_room($1, $2)`, [slug, 'smoke test']);
    console.log(`  create_room OK: ${r.rows[0].slug}`);
    if (jwtSecret) {
      const t = await client.query(
        `select * from public.create_tree($1, $2, $3, $4)`,
        [slug, 'テスト太郎', '1234', null]
      );
      const treeRes = t.rows[0].create_tree;
      console.log(`  create_tree OK: tree_id=${treeRes.tree_id}, recovery_key=${treeRes.recovery_key}`);
      const auth = await client.query(`select public.auth_tree($1, $2)`, [treeRes.tree_id, '1234']);
      console.log(`  auth_tree OK: token=${auth.rows[0].auth_tree.slice(0,40)}...`);
    } else {
      console.log('  (JWT_SECRET not set, skipping create_tree smoke test)');
    }
    // cleanup
    await client.query(`delete from public.rooms where slug = $1`, [slug]);
    console.log('  cleanup OK');
  } catch (e) {
    console.error('  SMOKE TEST FAILED:', e.message);
    process.exit(2);
  }

  console.log('\nALL OK');
} catch (e) {
  console.error('\nERROR:', e.message);
  if (e.position) console.error('  at position', e.position);
  if (e.where) console.error('  where:', e.where);
  if (e.detail) console.error('  detail:', e.detail);
  if (e.hint) console.error('  hint:', e.hint);
  process.exit(3);
} finally {
  await client.end();
}
