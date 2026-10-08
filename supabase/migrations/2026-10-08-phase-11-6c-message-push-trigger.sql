-- Phase 11.6c — push notification trigger on new messages
--
-- Fire-and-forget HTTP call to the send-push Edge Function whenever
-- a new message is inserted. Uses pg_net (async) so the insert path
-- is never blocked by network latency.
--
-- Config lives in public.app_config (RLS-denied). Two rows must be
-- seeded via SQL editor (not committed): service_role_key, send_push_url.

create extension if not exists pg_net;

create table if not exists public.app_config (
  key   text primary key,
  value text not null
);

alter table public.app_config enable row level security;
-- No policies → deny all. Only service_role (or security definer
-- functions) can read.

create or replace function public.notify_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  conv          record;
  recipient     uuid;
  sender_name   text;
  sr_key        text;
  endpoint      text;
  preview       text;
begin
  -- Skip soft-deleted rows
  if new.deleted_at is not null then
    return new;
  end if;

  -- Look up the conversation
  select * into conv from public.conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  -- Recipient = whoever in the conversation is NOT the sender
  if    conv.initiator_id = new.sender_id then recipient := conv.recipient_id;
  elsif conv.recipient_id = new.sender_id then recipient := conv.initiator_id;
  else  return new;  -- sender not in this conversation, skip
  end if;

  if recipient is null or recipient = new.sender_id then
    return new;
  end if;

  -- Sender display name
  select coalesce(nullif(display_name,''), username, 'New message')
    into sender_name
    from public.profiles
    where id = new.sender_id;

  -- Message preview: content text, or a placeholder for media-only
  preview := case
    when new.content is not null and length(new.content) > 0 then left(new.content, 120)
    when new.media_type is not null then '[media]'
    else 'New message'
  end;

  -- Config (silently skip if not seeded yet)
  select value into sr_key   from public.app_config where key = 'service_role_key';
  select value into endpoint from public.app_config where key = 'send_push_url';
  if sr_key is null or endpoint is null then
    return new;
  end if;

  -- Fire-and-forget HTTP POST to the send-push function
  perform net.http_post(
    url := endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || sr_key
    ),
    body := jsonb_build_object(
      'user_id', recipient,
      'title', coalesce(sender_name, 'New message'),
      'body', preview,
      'data', jsonb_build_object(
        'type', 'message',
        'conversation_id', new.conversation_id::text,
        'message_id', new.id::text
      )
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_new_message on public.messages;
create trigger trg_notify_on_new_message
  after insert on public.messages
  for each row
  execute function public.notify_on_new_message();
