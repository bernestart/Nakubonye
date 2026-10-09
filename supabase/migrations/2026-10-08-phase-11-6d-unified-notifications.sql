-- Phase 11.6d — unified push triggers
-- Depends on: 2026-10-08-phase-11-6c-message-push-trigger.sql (pg_net, app_config)

drop function if exists public._push_config();

create or replace function public._push_config()
returns table (cfg_sr_key text, cfg_endpoint text)
language sql
security definer
set search_path = public
stable
as $$
  select
    (select value from public.app_config where key = 'service_role_key'),
    (select value from public.app_config where key = 'send_push_url');
$$;

create or replace function public.notify_on_new_follow()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  actor_name text;
  sr_key     text;
  endpoint   text;
begin
  select cfg_sr_key, cfg_endpoint into sr_key, endpoint from public._push_config();
  if sr_key is null or endpoint is null then return new; end if;
  if new.follower_id = new.following_id then return new; end if;

  select coalesce(nullif(display_name,''), username, 'Someone')
    into actor_name from public.profiles where id = new.follower_id;

  perform net.http_post(
    url := endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||sr_key),
    body := jsonb_build_object(
      'user_id', new.following_id,
      'title', coalesce(actor_name, 'Someone'),
      'body', 'started following you',
      'data', jsonb_build_object('type','follow','actor_id',new.follower_id::text)
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_new_follow on public.follows;
create trigger trg_notify_on_new_follow after insert on public.follows
for each row execute function public.notify_on_new_follow();

create or replace function public.notify_on_new_like()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  actor_name text;
  sr_key     text;
  endpoint   text;
begin
  select cfg_sr_key, cfg_endpoint into sr_key, endpoint from public._push_config();
  if sr_key is null or endpoint is null then return new; end if;
  if new.user_id = new.liked_user_id then return new; end if;

  select coalesce(nullif(display_name,''), username, 'Someone')
    into actor_name from public.profiles where id = new.user_id;

  perform net.http_post(
    url := endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||sr_key),
    body := jsonb_build_object(
      'user_id', new.liked_user_id,
      'title', coalesce(actor_name, 'Someone'),
      'body', 'sent you a match request',
      'data', jsonb_build_object('type','like','actor_id',new.user_id::text)
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_new_like on public.likes;
create trigger trg_notify_on_new_like after insert on public.likes
for each row execute function public.notify_on_new_like();

create or replace function public.notify_on_new_match()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  name_one text;
  name_two text;
  sr_key   text;
  endpoint text;
begin
  select cfg_sr_key, cfg_endpoint into sr_key, endpoint from public._push_config();
  if sr_key is null or endpoint is null then return new; end if;

  select coalesce(nullif(display_name,''), username, 'Someone')
    into name_one from public.profiles where id = new.user_one_id;
  select coalesce(nullif(display_name,''), username, 'Someone')
    into name_two from public.profiles where id = new.user_two_id;

  perform net.http_post(
    url := endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||sr_key),
    body := jsonb_build_object(
      'user_id', new.user_one_id,
      'title', 'New match',
      'body', 'You matched with ' || coalesce(name_two, 'someone'),
      'data', jsonb_build_object('type','match','actor_id',new.user_two_id::text,'match_id',new.id::text)
    ),
    timeout_milliseconds := 5000
  );

  perform net.http_post(
    url := endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||sr_key),
    body := jsonb_build_object(
      'user_id', new.user_two_id,
      'title', 'New match',
      'body', 'You matched with ' || coalesce(name_one, 'someone'),
      'data', jsonb_build_object('type','match','actor_id',new.user_one_id::text,'match_id',new.id::text)
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_new_match on public.matches;
create trigger trg_notify_on_new_match after insert on public.matches
for each row execute function public.notify_on_new_match();
