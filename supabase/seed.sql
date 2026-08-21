-- Safe, repeatable local demo data. Staff identities are created separately by
-- `pnpm seed:staff` through Supabase Auth's Admin API.
insert into public.restaurant_tables (name)
values
  ('โต๊ะ 01'),
  ('โต๊ะ 02'),
  ('โต๊ะ 03'),
  ('โต๊ะ 04'),
  ('โต๊ะ 05')
on conflict do nothing;
