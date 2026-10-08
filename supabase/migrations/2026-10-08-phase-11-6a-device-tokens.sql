-- Phase 11.6a — device tokens for push notifications
-- Stores FCM tokens per user; RLS restricts to owner only

create table if not exists public.device_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token       text not null,
  platform    text not null default 'android',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists idx_device_tokens_user
  on public.device_tokens(user_id);

create index if not exists idx_device_tokens_token
  on public.device_tokens(token);

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_select_own" on public.device_tokens;
create policy "device_tokens_select_own"
  on public.device_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "device_tokens_insert_own" on public.device_tokens;
create policy "device_tokens_insert_own"
  on public.device_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "device_tokens_update_own" on public.device_tokens;
create policy "device_tokens_update_own"
  on public.device_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "device_tokens_delete_own" on public.device_tokens;
create policy "device_tokens_delete_own"
  on public.device_tokens for delete
  using (auth.uid() = user_id);

create or replace function public.device_tokens_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_device_tokens_touch on public.device_tokens;
create trigger trg_device_tokens_touch
  before update on public.device_tokens
  for each row execute function public.device_tokens_touch();
