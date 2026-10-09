-- Phase 11.6d.2 — engagement push triggers
--
-- Extends 11.6d with notifications for posts, comments, reactions, reels.
-- Same pattern as 11.6d: fire-and-forget net.http_post → send-push.
-- Uses public._push_config() (from 11.6d).
--
-- Depends on:
--   2026-10-08-phase-11-6c-message-push-trigger.sql (pg_net, app_config)
--   2026-10-08-phase-11-6d-unified-notifications.sql (_push_config helper)

-- ===========================================================================
-- HELPER: push to a user with given title/body/data
-- ===========================================================================
create or replace function public._push_send(
  p_user_id uuid,
  p_title   text,
  p_body    text,
  p_data    jsonb
)
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  sr_key   text;
  endpoint text;
begin
  if p_user_id is null then return; end if;

  select cfg_sr_key, cfg_endpoint into sr_key, endpoint from public._push_config();
  if sr_key is null or endpoint is null then return; end if;

  perform net.http_post(
    url := endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || sr_key
    ),
    body := jsonb_build_object(
      'user_id', p_user_id,
      'title',   coalesce(p_title, 'Nakubonye'),
      'body',    coalesce(p_body, ''),
      'data',    coalesce(p_data, '{}'::jsonb)
    ),
    timeout_milliseconds := 5000
  );
end;
$$;

-- ===========================================================================
-- 1) user_post_likes — notify post owner
-- ===========================================================================
create or replace function public.notify_on_user_post_like()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  owner_id   uuid;
  actor_name text;
  body_text  text;
begin
  select user_id into owner_id from public.user_posts where id = new.post_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;

  select coalesce(nullif(display_name,''), username, 'Someone')
    into actor_name from public.profiles where id = new.user_id;

  body_text := case
    when new.reaction = '❤️' then 'loved your post'
    else 'reacted to your post'
  end;

  perform public._push_send(
    owner_id,
    coalesce(actor_name, 'Someone'),
    body_text,
    jsonb_build_object('type','post_like','actor_id',new.user_id::text,'post_id',new.post_id::text)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_user_post_like on public.user_post_likes;
create trigger trg_notify_on_user_post_like
  after insert on public.user_post_likes
  for each row execute function public.notify_on_user_post_like();

-- ===========================================================================
-- 2 + 3) user_post_comments — owner on top-level, commenter on reply
-- ===========================================================================
create or replace function public.notify_on_user_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  owner_id      uuid;
  parent_author uuid;
  actor_name    text;
  target_id     uuid;
  body_text     text;
begin
  if new.deleted_at is not null then return new; end if;

  select coalesce(nullif(display_name,''), username, 'Someone')
    into actor_name from public.profiles where id = new.user_id;

  if new.reply_to_id is not null then
    select user_id into parent_author
      from public.user_post_comments where id = new.reply_to_id;
    if parent_author is null or parent_author = new.user_id then return new; end if;

    perform public._push_send(
      parent_author,
      coalesce(actor_name, 'Someone'),
      'replied to your comment',
      jsonb_build_object('type','comment_reply','actor_id',new.user_id::text,'post_id',new.post_id::text)
    );
    return new;
  end if;

  select user_id into owner_id from public.user_posts where id = new.post_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;

  perform public._push_send(
    owner_id,
    coalesce(actor_name, 'Someone'),
    'commented on your post',
    jsonb_build_object('type','post_comment','actor_id',new.user_id::text,'post_id',new.post_id::text)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_user_post_comment on public.user_post_comments;
create trigger trg_notify_on_user_post_comment
  after insert on public.user_post_comments
  for each row execute function public.notify_on_user_post_comment();

-- ===========================================================================
-- 4) community_post_reactions — notify post author
-- ===========================================================================
create or replace function public.notify_on_community_post_reaction()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  owner_id   uuid;
  actor_name text;
begin
  select author_id into owner_id from public.community_posts where id = new.post_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;

  select coalesce(nullif(display_name,''), username, 'Someone')
    into actor_name from public.profiles where id = new.user_id;

  perform public._push_send(
    owner_id,
    coalesce(actor_name, 'Someone'),
    'reacted to your post',
    jsonb_build_object('type','community_post_reaction','actor_id',new.user_id::text,'post_id',new.post_id::text)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_community_post_reaction on public.community_post_reactions;
create trigger trg_notify_on_community_post_reaction
  after insert on public.community_post_reactions
  for each row execute function public.notify_on_community_post_reaction();

-- ===========================================================================
-- 5 + 6) community_post_comments
-- ===========================================================================
create or replace function public.notify_on_community_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  owner_id      uuid;
  parent_author uuid;
  actor_name    text;
begin
  if new.deleted_at is not null then return new; end if;

  select coalesce(nullif(display_name,''), username, 'Someone')
    into actor_name from public.profiles where id = new.user_id;

  if new.reply_to_id is not null then
    select user_id into parent_author
      from public.community_post_comments where id = new.reply_to_id;
    if parent_author is null or parent_author = new.user_id then return new; end if;

    perform public._push_send(
      parent_author,
      coalesce(actor_name, 'Someone'),
      'replied to your comment',
      jsonb_build_object('type','community_comment_reply','actor_id',new.user_id::text,'post_id',new.post_id::text)
    );
    return new;
  end if;

  select author_id into owner_id from public.community_posts where id = new.post_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;

  perform public._push_send(
    owner_id,
    coalesce(actor_name, 'Someone'),
    'commented on your post',
    jsonb_build_object('type','community_post_comment','actor_id',new.user_id::text,'post_id',new.post_id::text)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_community_post_comment on public.community_post_comments;
create trigger trg_notify_on_community_post_comment
  after insert on public.community_post_comments
  for each row execute function public.notify_on_community_post_comment();

-- ===========================================================================
-- 7) reel_likes — notify reel owner
-- ===========================================================================
create or replace function public.notify_on_reel_like()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  owner_id   uuid;
  actor_name text;
begin
  select user_id into owner_id from public.reels where id = new.reel_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;

  select coalesce(nullif(display_name,''), username, 'Someone')
    into actor_name from public.profiles where id = new.user_id;

  perform public._push_send(
    owner_id,
    coalesce(actor_name, 'Someone'),
    'liked your reel',
    jsonb_build_object('type','reel_like','actor_id',new.user_id::text,'reel_id',new.reel_id::text)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_reel_like on public.reel_likes;
create trigger trg_notify_on_reel_like
  after insert on public.reel_likes
  for each row execute function public.notify_on_reel_like();

-- ===========================================================================
-- 8 + 9) reel_comments
-- ===========================================================================
create or replace function public.notify_on_reel_comment()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  owner_id      uuid;
  parent_author uuid;
  actor_name    text;
begin
  if new.deleted_at is not null then return new; end if;

  select coalesce(nullif(display_name,''), username, 'Someone')
    into actor_name from public.profiles where id = new.user_id;

  if new.reply_to_id is not null then
    select user_id into parent_author
      from public.reel_comments where id = new.reply_to_id;
    if parent_author is null or parent_author = new.user_id then return new; end if;

    perform public._push_send(
      parent_author,
      coalesce(actor_name, 'Someone'),
      'replied to your comment',
      jsonb_build_object('type','reel_comment_reply','actor_id',new.user_id::text,'reel_id',new.reel_id::text)
    );
    return new;
  end if;

  select user_id into owner_id from public.reels where id = new.reel_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;

  perform public._push_send(
    owner_id,
    coalesce(actor_name, 'Someone'),
    'commented on your reel',
    jsonb_build_object('type','reel_comment','actor_id',new.user_id::text,'reel_id',new.reel_id::text)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_reel_comment on public.reel_comments;
create trigger trg_notify_on_reel_comment
  after insert on public.reel_comments
  for each row execute function public.notify_on_reel_comment();

-- ===========================================================================
-- 10) reel_comment_reactions — notify comment author
-- ===========================================================================
create or replace function public.notify_on_reel_comment_reaction()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  comment_author uuid;
  actor_name     text;
begin
  select user_id into comment_author
    from public.reel_comments where id = new.comment_id;
  if comment_author is null or comment_author = new.user_id then return new; end if;

  select coalesce(nullif(display_name,''), username, 'Someone')
    into actor_name from public.profiles where id = new.user_id;

  perform public._push_send(
    comment_author,
    coalesce(actor_name, 'Someone'),
    'reacted to your comment',
    jsonb_build_object('type','comment_reaction','actor_id',new.user_id::text,'comment_id',new.comment_id::text)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_on_reel_comment_reaction on public.reel_comment_reactions;
create trigger trg_notify_on_reel_comment_reaction
  after insert on public.reel_comment_reactions
  for each row execute function public.notify_on_reel_comment_reaction();
