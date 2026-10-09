-- Phase 11.6e.3 — add comment_id / reel_id to push payloads for deep-linking
-- Updates 4 triggers from 11.6d.2 so taps land on the exact comment.

-- user_post_comments — add comment_id
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
      jsonb_build_object(
        'type','comment_reply',
        'actor_id',new.user_id::text,
        'post_id',new.post_id::text,
        'comment_id',new.id::text
      )
    );
    return new;
  end if;

  select user_id into owner_id from public.user_posts where id = new.post_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;

  perform public._push_send(
    owner_id,
    coalesce(actor_name, 'Someone'),
    'commented on your post',
    jsonb_build_object(
      'type','post_comment',
      'actor_id',new.user_id::text,
      'post_id',new.post_id::text,
      'comment_id',new.id::text
    )
  );
  return new;
end;
$$;

-- community_post_comments — add comment_id
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
      jsonb_build_object(
        'type','community_comment_reply',
        'actor_id',new.user_id::text,
        'post_id',new.post_id::text,
        'comment_id',new.id::text
      )
    );
    return new;
  end if;

  select author_id into owner_id from public.community_posts where id = new.post_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;

  perform public._push_send(
    owner_id,
    coalesce(actor_name, 'Someone'),
    'commented on your post',
    jsonb_build_object(
      'type','community_post_comment',
      'actor_id',new.user_id::text,
      'post_id',new.post_id::text,
      'comment_id',new.id::text
    )
  );
  return new;
end;
$$;

-- reel_comments — add comment_id
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
      jsonb_build_object(
        'type','reel_comment_reply',
        'actor_id',new.user_id::text,
        'reel_id',new.reel_id::text,
        'comment_id',new.id::text
      )
    );
    return new;
  end if;

  select user_id into owner_id from public.reels where id = new.reel_id;
  if owner_id is null or owner_id = new.user_id then return new; end if;

  perform public._push_send(
    owner_id,
    coalesce(actor_name, 'Someone'),
    'commented on your reel',
    jsonb_build_object(
      'type','reel_comment',
      'actor_id',new.user_id::text,
      'reel_id',new.reel_id::text,
      'comment_id',new.id::text
    )
  );
  return new;
end;
$$;

-- reel_comment_reactions — add reel_id for navigation
create or replace function public.notify_on_reel_comment_reaction()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  comment_author uuid;
  parent_reel    bigint;
  actor_name     text;
begin
  select user_id, reel_id into comment_author, parent_reel
    from public.reel_comments where id = new.comment_id;
  if comment_author is null or comment_author = new.user_id then return new; end if;

  select coalesce(nullif(display_name,''), username, 'Someone')
    into actor_name from public.profiles where id = new.user_id;

  perform public._push_send(
    comment_author,
    coalesce(actor_name, 'Someone'),
    'reacted to your comment',
    jsonb_build_object(
      'type','comment_reaction',
      'actor_id',new.user_id::text,
      'comment_id',new.comment_id::text,
      'reel_id',coalesce(parent_reel::text, '')
    )
  );
  return new;
end;
$$;
