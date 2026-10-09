-- Phase 11.6d4 — push trigger for story mentions
-- Mirrors style of 2026-10-08-phase-11-6d-unified-notifications.sql

create or replace function public.notify_on_mention()
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
  if new.type is distinct from 'mention' then return new; end if;

  select cfg_sr_key, cfg_endpoint into sr_key, endpoint from public._push_config();
  if sr_key is null or endpoint is null then return new; end if;

  select coalesce(nullif(display_name,''), username, 'Someone')
    into actor_name from public.profiles where id = new.actor_id;

  perform net.http_post(
    url := endpoint,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||sr_key),
    body := jsonb_build_object(
      'user_id', new.user_id,
      'title', coalesce(actor_name, 'Someone'),
      'body', coalesce(new.body, 'mentioned you in a story'),
      'data', jsonb_build_object(
        'type','mention',
        'actor_id', new.actor_id::text,
        'story_id', coalesce(new.ref_id::text, '')
      )
    ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_mention on public.notifications;
create trigger trg_notify_on_mention after insert on public.notifications
for each row when (new.type = 'mention')
execute function public.notify_on_mention();
