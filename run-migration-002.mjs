// migration 002 を適用 + smoke test
// DATABASE_URL="..." node run-migration-002.mjs
import pg from './node_modules/pg/lib/index.js';
import fs from 'node:fs/promises';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL required'); process.exit(1); }

const sql = await fs.readFile('./supabase/migrations/002_detail_drag.sql', 'utf8');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  console.log('Applying 002_detail_drag.sql ...');
  await client.query(sql);
  console.log('  OK');

  console.log('\nVerifying columns:');
  const cols = await client.query(`
    select column_name, data_type
    from information_schema.columns
    where table_schema='public' and table_name='nodes'
      and column_name in ('description','offset_x','offset_y')
    order by column_name
  `);
  cols.rows.forEach(r => console.log(' ', r.column_name, ':', r.data_type));
  if (cols.rows.length !== 3) throw new Error('missing columns');

  const fns = await client.query(`
    select proname, pronargs from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname in ('upsert_node','update_tree_position','clear_node_field')
    order by proname, pronargs
  `);
  console.log('\nFunctions:');
  fns.rows.forEach(r => console.log(' ', r.proname, 'args:', r.pronargs));

  console.log('\nSmoke test: create_room → create_tree → upsert_node (with desc+offset) → update_tree_position');
  const slug = '_smk002_' + Date.now();
  await client.query('select public.create_room($1,$2)', [slug, 'smk']);
  const t = (await client.query('select public.create_tree($1,$2,$3,$4) as r', [slug, 'テストA', '9999', null])).rows[0].r;
  const tok = (await client.query('select public.auth_tree($1,$2) as t', [t.tree_id, '9999'])).rows[0].t;
  const n = (await client.query(
    'select public.upsert_node($1,$2,null::uuid,$3,$4::smallint,$5,$6::smallint,$7,$8::numeric,$9::numeric) as n',
    [tok, t.tree_id, 'パン作り', 4, '#c49a3e', 0, '実家がパン屋で毎朝手伝ってます', 30.5, -40]
  )).rows[0].n;
  console.log('  node:', n);
  await client.query('select public.update_tree_position($1,$2,$3::numeric,$4::numeric)', [tok, t.tree_id, 123.4, -56.7]);
  const tpos = (await client.query('select x, y from public.trees where id=$1', [t.tree_id])).rows[0];
  console.log('  tree pos:', tpos);
  await client.query('delete from public.rooms where slug=$1', [slug]);
  console.log('  cleanup OK');
  console.log('\nALL OK');
} catch (e) {
  console.error('\nERROR:', e.message);
  if (e.detail) console.error(' detail:', e.detail);
  if (e.hint) console.error(' hint:', e.hint);
  process.exit(2);
} finally {
  await client.end();
}
