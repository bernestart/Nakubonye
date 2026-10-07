-- ============================================================
-- Audit Phase 8C — RLS hardening
-- Created 2026-10-07
-- Applied live to Supabase. Save for rebuild/migration.
-- ============================================================

-- 1. user_posts: audience + circle + blocks
drop policy if exists "user_posts_read" on public.user_posts;
create policy "user_posts_read" on public.user_posts
for select using (
  is_active = true
  and (
    user_id = auth.uid()
    or (
      audience = 'public'
      and not exists (
        select 1 from blocks
        where (blocker_id = auth.uid() and blocked_id = user_posts.user_id)
           or (blocker_id = user_posts.user_id and blocked_id = auth.uid())
      )
    )
    or (
      audience = 'matches'
      and exists (
        select 1 from matches m
        where (m.user_one_id = auth.uid() and m.user_two_id = user_posts.user_id)
           or (m.user_two_id = auth.uid() and m.user_one_id = user_posts.user_id)
      )
      and not exists (
        select 1 from blocks
        where (blocker_id = auth.uid() and blocked_id = user_posts.user_id)
           or (blocker_id = user_posts.user_id and blocked_id = auth.uid())
      )
    )
    or (
      audience like 'circle:%'
      and exists (
        select 1 from circles c
        join circle_members cm on cm.circle_id = c.id
        where c.id::text = substring(user_posts.audience from 8)
          and c.owner_id = user_posts.user_id
          and cm.user_id = auth.uid()
      )
      and not exists (
        select 1 from blocks
        where (blocker_id = auth.uid() and blocked_id = user_posts.user_id)
           or (blocker_id = user_posts.user_id and blocked_id = auth.uid())
      )
    )
  )
);

-- 2. community_posts: public/private + membership + blocks
drop policy if exists "community_posts_read" on public.community_posts;
create policy "community_posts_read" on public.community_posts
for select using (
  deleted_at is null
  and exists (
    select 1 from public.communities c
    where c.id = community_posts.community_id
      and c.is_active = true
      and (
        (
          c.privacy = 'public'
          and not exists (
            select 1 from public.blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = community_posts.author_id)
               or (b.blocker_id = community_posts.author_id and b.blocked_id = auth.uid())
          )
        )
        or (
          c.privacy <> 'public'
          and exists (
            select 1 from public.community_memberships cm
            where cm.community_id = community_posts.community_id
              and cm.user_id = auth.uid()
          )
        )
      )
  )
);

-- 3. story_views: own views or views on own stories
drop policy if exists "sv_read" on public.story_views;
create policy "sv_read" on public.story_views
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from stories s
    where s.id = story_views.story_id
      and s.user_id = auth.uid()
  )
);

-- 4. photos: profile public, community gated
drop policy if exists "photos_select" on public.photos;
create policy "photos_select" on public.photos
for select using (
  bucket = 'profile-photos'
  or (
    bucket = 'community-media'
    and source = 'post'
    and exists (
      select 1 from community_posts cp
      join community_memberships cm on cm.community_id = cp.community_id
      where cp.id = photos.source_ref::bigint
        and cm.user_id = auth.uid()
        and cp.deleted_at is null
    )
  )
  or user_id = auth.uid()
);

-- 5. user_post_likes: gate on post audience + blocks
drop policy if exists "upl_read" on public.user_post_likes;
create policy "upl_read" on public.user_post_likes
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.user_posts up
    where up.id = user_post_likes.post_id
      and up.is_active = true
      and (
        up.user_id = auth.uid()
        or (
          coalesce(up.audience, 'public') in ('public', 'everyone')
          and not exists (
            select 1 from public.blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = up.user_id)
               or (b.blocker_id = up.user_id and b.blocked_id = auth.uid())
          )
        )
        or (
          up.audience = 'matches'
          and exists (
            select 1 from public.matches m
            where (m.user_one_id = auth.uid() and m.user_two_id = up.user_id)
               or (m.user_two_id = auth.uid() and m.user_one_id = up.user_id)
          )
        )
        or (
          up.audience like 'circle:%'
          and exists (
            select 1 from public.circle_members cm
            where cm.user_id = auth.uid()
              and cm.circle_id::text = substring(up.audience from 8)
          )
        )
      )
  )
);

-- 6. user_post_comments: same pattern
drop policy if exists "upc_read" on public.user_post_comments;
create policy "upc_read" on public.user_post_comments
for select using (
  deleted_at is null
  and (
    user_id = auth.uid()
    or exists (
      select 1 from public.user_posts up
      where up.id = user_post_comments.post_id
        and up.is_active = true
        and (
          up.user_id = auth.uid()
          or (
            coalesce(up.audience, 'public') in ('public', 'everyone')
            and not exists (
              select 1 from public.blocks b
              where (b.blocker_id = auth.uid() and b.blocked_id = up.user_id)
                 or (b.blocker_id = up.user_id and b.blocked_id = auth.uid())
            )
          )
          or (
            up.audience = 'matches'
            and exists (
              select 1 from public.matches m
              where (m.user_one_id = auth.uid() and m.user_two_id = up.user_id)
                 or (m.user_two_id = auth.uid() and m.user_one_id = up.user_id)
            )
          )
          or (
            up.audience like 'circle:%'
            and exists (
              select 1 from public.circle_members cm
              where cm.user_id = auth.uid()
                and cm.circle_id::text = substring(up.audience from 8)
            )
          )
        )
    )
  )
);

-- 7. reel_likes
drop policy if exists "reel_likes_read" on public.reel_likes;
create policy "reel_likes_read" on public.reel_likes
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.reels r
    where r.id = reel_likes.reel_id
      and r.is_active = true
      and (
        r.user_id = auth.uid()
        or (
          coalesce(r.audience, 'public') in ('public', 'everyone')
          and not exists (
            select 1 from public.blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
               or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
          )
        )
        or (
          r.audience = 'matches'
          and exists (
            select 1 from public.matches m
            where (m.user_one_id = auth.uid() and m.user_two_id = r.user_id)
               or (m.user_two_id = auth.uid() and m.user_one_id = r.user_id)
          )
        )
        or (
          r.audience like 'circle:%'
          and exists (
            select 1 from public.circle_members cm
            where cm.user_id = auth.uid()
              and cm.circle_id::text = substring(r.audience from 8)
          )
        )
      )
  )
);

-- 8. reel_comments: same pattern
drop policy if exists "reel_comments_read" on public.reel_comments;
create policy "reel_comments_read" on public.reel_comments
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.reels r
    where r.id = reel_comments.reel_id
      and r.is_active = true
      and (
        r.user_id = auth.uid()
        or (
          coalesce(r.audience, 'public') in ('public', 'everyone')
          and not exists (
            select 1 from public.blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
               or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
          )
        )
        or (
          r.audience = 'matches'
          and exists (
            select 1 from public.matches m
            where (m.user_one_id = auth.uid() and m.user_two_id = r.user_id)
               or (m.user_two_id = auth.uid() and m.user_one_id = r.user_id)
          )
        )
        or (
          r.audience like 'circle:%'
          and exists (
            select 1 from public.circle_members cm
            where cm.user_id = auth.uid()
              and cm.circle_id::text = substring(r.audience from 8)
          )
        )
      )
  )
);

-- 9. community_post_comments: public/private aware
drop policy if exists "cpc_read" on public.community_post_comments;
create policy "cpc_read" on public.community_post_comments
for select using (
  exists (
    select 1 from public.community_posts cp
    join public.communities c on c.id = cp.community_id
    where cp.id = community_post_comments.post_id
      and cp.deleted_at is null
      and c.is_active = true
      and (
        (
          c.privacy = 'public'
          and not exists (
            select 1 from public.blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = cp.author_id)
               or (b.blocker_id = cp.author_id and b.blocked_id = auth.uid())
          )
        )
        or (
          c.privacy <> 'public'
          and exists (
            select 1 from public.community_memberships cm
            where cm.community_id = cp.community_id
              and cm.user_id = auth.uid()
          )
        )
      )
  )
);

-- 10. community_post_reactions: same pattern
drop policy if exists "community_post_reactions_read" on public.community_post_reactions;
create policy "community_post_reactions_read" on public.community_post_reactions
for select using (
  exists (
    select 1 from public.community_posts cp
    join public.communities c on c.id = cp.community_id
    where cp.id = community_post_reactions.post_id
      and cp.deleted_at is null
      and c.is_active = true
      and (
        (
          c.privacy = 'public'
          and not exists (
            select 1 from public.blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = cp.author_id)
               or (b.blocker_id = cp.author_id and b.blocked_id = auth.uid())
          )
        )
        or (
          c.privacy <> 'public'
          and exists (
            select 1 from public.community_memberships cm
            where cm.community_id = cp.community_id
              and cm.user_id = auth.uid()
          )
        )
      )
  )
);

-- 11. community_memberships: public list or members-only
drop policy if exists "community_memberships_read" on public.community_memberships;
create policy "community_memberships_read" on public.community_memberships
for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.communities c
    where c.id = community_memberships.community_id
      and c.is_active = true
      and (
        c.privacy = 'public'
        or (
          c.privacy <> 'public'
          and exists (
            select 1 from public.community_memberships cm2
            where cm2.community_id = c.id
              and cm2.user_id = auth.uid()
          )
        )
      )
  )
);

-- 12. follows: respects followers_list_visibility + blocks
drop policy if exists "follows_read" on public.follows;
create policy "follows_read" on public.follows
for select using (
  follower_id = auth.uid()
  or following_id = auth.uid()
  or (
    not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = follows.following_id)
         or (b.blocker_id = follows.following_id and b.blocked_id = auth.uid())
    )
    and coalesce(
      (select followers_list_visibility from public.user_settings where user_id = follows.following_id),
      'everyone'
    ) != 'only_me'
    and (
      coalesce(
        (select followers_list_visibility from public.user_settings where user_id = follows.following_id),
        'everyone'
      ) = 'everyone'
      or (
        (select followers_list_visibility from public.user_settings where user_id = follows.following_id) = 'followers'
        and exists (
          select 1 from public.follows f2
          where f2.follower_id = auth.uid() and f2.following_id = follows.following_id
        )
      )
      or (
        (select followers_list_visibility from public.user_settings where user_id = follows.following_id) = 'matches'
        and exists (
          select 1 from public.matches m
          where (m.user_one_id = auth.uid() and m.user_two_id = follows.following_id)
             or (m.user_two_id = auth.uid() and m.user_one_id = follows.following_id)
        )
      )
    )
  )
);

-- 13. notifications: filter blocks + mutes on actor
drop policy if exists "notif_read_own" on public.notifications;
create policy "notif_read_own" on public.notifications
for select using (
  auth.uid() = user_id
  and (
    actor_id is null
    or (
      not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = notifications.actor_id)
           or (b.blocker_id = notifications.actor_id and b.blocked_id = auth.uid())
      )
      and not exists (
        select 1 from public.user_mutes um
        where um.muter_id = auth.uid() and um.muted_id = notifications.actor_id
      )
    )
  )
);

-- ============================================================
-- End of Phase 8C
-- ============================================================

-- ============================================================
-- Phase 8C addendum — tables continued
-- ============================================================

-- story_highlights
drop policy if exists "story_highlights_select" on public.story_highlights;
create policy "story_highlights_select" on public.story_highlights
for select using (
  user_id = auth.uid()
  or (
    not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = story_highlights.user_id)
         or (b.blocker_id = story_highlights.user_id and b.blocked_id = auth.uid())
    )
    and (
      coalesce((select who_can_see_story from public.user_settings where user_id = story_highlights.user_id),'everyone') = 'everyone'
      or (
        (select who_can_see_story from public.user_settings where user_id = story_highlights.user_id) = 'followers'
        and exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = story_highlights.user_id)
      )
      or (
        (select who_can_see_story from public.user_settings where user_id = story_highlights.user_id) = 'matches'
        and exists (select 1 from public.matches m
          where (m.user_one_id = auth.uid() and m.user_two_id = story_highlights.user_id)
             or (m.user_two_id = auth.uid() and m.user_one_id = story_highlights.user_id))
      )
    )
  )
);

-- story_highlight_items
drop policy if exists "story_highlight_items_select" on public.story_highlight_items;
create policy "story_highlight_items_select" on public.story_highlight_items
for select using (
  exists (
    select 1 from public.story_highlights sh
    where sh.id = story_highlight_items.highlight_id
      and (
        sh.user_id = auth.uid()
        or (
          not exists (select 1 from public.blocks b
            where (b.blocker_id = auth.uid() and b.blocked_id = sh.user_id)
               or (b.blocker_id = sh.user_id and b.blocked_id = auth.uid()))
          and (
            coalesce((select who_can_see_story from public.user_settings where user_id = sh.user_id),'everyone') = 'everyone'
            or ((select who_can_see_story from public.user_settings where user_id = sh.user_id) = 'followers'
              and exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = sh.user_id))
            or ((select who_can_see_story from public.user_settings where user_id = sh.user_id) = 'matches'
              and exists (select 1 from public.matches m
                where (m.user_one_id = auth.uid() and m.user_two_id = sh.user_id)
                   or (m.user_two_id = auth.uid() and m.user_one_id = sh.user_id)))
          )
        )
      )
  )
);

-- events
drop policy if exists "events_select" on public.events;
create policy "events_select" on public.events
for select using (
  not exists (select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = events.host_id)
       or (b.blocker_id = events.host_id and b.blocked_id = auth.uid()))
  and (
    host_id = auth.uid()
    or (privacy = 'private' and exists (select 1 from public.event_attendees ea where ea.event_id = events.id and ea.user_id = auth.uid()))
    or (privacy = 'matches' and exists (select 1 from public.matches m
      where (m.user_one_id = auth.uid() and m.user_two_id = events.host_id)
         or (m.user_two_id = auth.uid() and m.user_one_id = events.host_id)))
    or (privacy = 'following' and exists (select 1 from public.follows f
      where f.follower_id = events.host_id and f.following_id = auth.uid()))
    or privacy = 'public'
  )
);

-- event_attendees
drop policy if exists "event_attendees_select" on public.event_attendees;
create policy "event_attendees_select" on public.event_attendees
for select using (
  user_id = auth.uid()
  and exists (
    select 1 from public.events e
    where e.id = event_attendees.event_id
      and not exists (select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = e.host_id)
           or (b.blocker_id = e.host_id and b.blocked_id = auth.uid()))
      and (
        e.host_id = auth.uid()
        or e.privacy = 'public'
        or (e.privacy = 'private' and exists (select 1 from public.event_attendees ea2 where ea2.event_id = e.id and ea2.user_id = auth.uid()))
        or (e.privacy = 'matches' and exists (select 1 from public.matches m
          where (m.user_one_id = auth.uid() and m.user_two_id = e.host_id)
             or (m.user_two_id = auth.uid() and m.user_one_id = e.host_id)))
        or (e.privacy = 'following' and exists (select 1 from public.follows f
          where f.follower_id = e.host_id and f.following_id = auth.uid()))
      )
  )
);

-- listings
drop policy if exists "listings_read" on public.listings;
create policy "listings_read" on public.listings
for select using (
  status = 'active'
  and not exists (select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = listings.seller_id)
       or (b.blocker_id = listings.seller_id and b.blocked_id = auth.uid()))
);

-- services
drop policy if exists "services_read" on public.services;
create policy "services_read" on public.services
for select using (
  status = 'active'
  and not exists (select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = services.provider_id)
       or (b.blocker_id = services.provider_id and b.blocked_id = auth.uid()))
);

-- polls, poll_options, poll_votes — gate on parent post visibility
-- (see live DB; long CASE expressions; omit from migration for brevity)

-- app_config — public (maintenance flags only, no secrets)
