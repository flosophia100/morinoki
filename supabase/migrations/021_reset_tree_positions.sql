-- 021_reset_tree_positions.sql
-- 樹の x/y をすべて 0 に戻す。
-- クライアント側 layoutRandom が tree.id(UUID)から決定論的に
-- 円内一様分布で再配置するので、全クライアントで同じ位置になる。
--
-- 適用後、一度でもドラッグされれば個別に update_tree_position で上書きされる。

update public.trees set x = 0, y = 0;
