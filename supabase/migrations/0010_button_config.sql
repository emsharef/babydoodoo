-- 0010_button_config.sql
-- Adds a per-baby button configuration JSONB column.
-- Parents/owners can UPDATE babies per existing RLS policy.
alter table public.babies
  add column if not exists button_config jsonb;
