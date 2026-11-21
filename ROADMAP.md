# NAKUBONYE ROADMAP (saved 2026-11-21)

## VISION
Meta-style social network from Burundi for the world: feeds, posts, stories, reels, DM / group / community chat, realtime presence, instant UX. Start on free tiers, upgrade by usage. Each growth stage = flip billing or shard, never a rewrite.

## TARGETS (measurable)
- Crash-free sessions >= 99.5% (needs Sentry). Zero unauthenticated or cross-user data access.
- Message send: appears instantly (optimistic), server ack < 300 ms p95, online recipient < 1 s.
- Feed / profile / chat lists from cache < 100 ms, background refresh, no spinners, no page reloads.
- Initial JS < 300 KB gzip (today: one 2.1 MB chunk, 508 KB gzip).
- Stages (verify prices and limits before each): A 0-2k DAU free tiers. B 2k-50k Workers Paid + Neon paid + Upstash paid (low tens of USD/mo). C 50k+ shard big rooms, feed fan-out, R2/CDN, read replicas. D millions: infra decisions funded by revenue.
- "Zero bugs" is not provable; target is: found in minutes (Sentry), fixed fast, critical paths tested.

## RULES
1. Audit before patching. One phase = one commit + tag; tag before each phase for rollback.
2. Patch scripts live in scripts/*.cjs, anchor-checked, abort with nothing written if an anchor misses.
3. git push auto-deploys the Worker LIVE. Worker changes must stay compatible with the installed APK. New enforcement ships log-only behind a flag first.
4. Daily loop: patch -> npm run build -> Chrome test (npm run dev -- --host) -> commit -> push.
5. APK only at milestones: before AUTH_ENFORCE=1, native/Capacitor changes, FCM push, end of a big phase, before real users.
6. APK commands, one at a time, on screen, no wake locks: npm run build ; npx cap sync android ; cd android && ./gradlew clean assembleDebug --no-daemon --console=plain ; cp app/build/outputs/apk/debug/app-debug.apk ~/storage/downloads/nakubonye-NAME.apk
7. Free only: no service that needs a payment method until revenue (R2 deferred).
8. Never paste secrets or tokens.

## CURRENT ARCHITECTURE (facts from audit)
- React 19 + Vite + Capacitor 8 (Android). Worker backend/_worker.js on Cloudflare (auto-deploy from GitHub main). Neon Postgres via HTTP /sql, Upstash Redis (presence, likes), Telegram Bot API media proxy (/api/media, 20 MB cap), Better Auth (backend/auth.js) with bearer tokens, Supabase still used by ~1,246 call sites.
- One Durable Object class ChatRoomSQLite (hibernation API). Rooms: DM = dm-<conversationId> (bigint), group = group-<groupId> (uuid), community = <communityId> (bare bigint). WS URL /api/ws/<room>?token=...
- IDs: app tables uuid; Better Auth user.id is text (uuid-shaped via randomUUID). ~130 Neon tables, only function get_ranked_feed. All communities are privacy=public. Likes live only in Redis.
- Membership: DM = conversations.initiator_id/recipient_id or linked matches(user_one_id,user_two_id); group = group_members; community = community_memberships minus community_bans. blocks table exists, unchecked.

## STATUS
- P0 done (tag baseline-1). P1 applied + pushed in LOG-ONLY mode (scripts/p1-auth-gate.cjs, tag pre-p1); not yet shadow-tested.

## PHASES (each has an exit test)
P1 AUTH ENFORCEMENT (blocker)
 1a-1d DONE log-only: Worker session check, whoami, WS token + upgrade-only, DO frame filter + close fix, client fetch wrapper (src/lib/authFetch.js).
 Next: shadow test in Chrome; 1e per-chat membership + block checks (MEMBER_ENFORCE flag), rate limits (Upstash), input validation (zod), authenticated upload; then APK milestone and set AUTH_ENFORCE=1 secret in Cloudflare dashboard.
 Exit: no token -> 401; user A cannot act as or read as user B; non-member cannot read/post in DM, group or community room.
P2 SINGLE SOURCE OF TRUTH (largest)
 Move Supabase usage to Worker + Neon, in this order: profiles/follows/photos -> DM, group, community chat -> posts/comments/likes -> stories -> reels -> notifications/settings/matches -> marketplace/services/events -> admin. Reimplement ~25 Supabase RPCs (like_user, can_send_message, send_direct_message, ...) as Worker routes with session auth. Replace supabase.auth calls (reset/change password) with Better Auth. Remove supabase-js and jsonwebtoken.
 Exit: grep -r supabase src = 0; each moved feature tested in all 3 chat types where relevant.
P3 REALTIME HARDENING
 One shared WS hook (reconnect with backoff, resume since last id, dedupe), offline send queue, typing via WS frames, read receipts, persist likes to Neon user_post_likes (Redis as cache), community messages join sender name, remove hardcoded Worker URL.
 Exit: airplane-mode toggle mid-chat loses no messages.
P4 INSTANT UX
 TanStack Query provider; cached feed / profile / chat lists (stale-while-revalidate); optimistic send, like, comment with rollback; lazy-load routes; skeletons; remove window.location.reload.
 Exit: feed shows from cache < 100 ms; initial JS < 300 KB gzip.
P5 OBSERVABILITY + CI
 Sentry (app + Worker, verify free tier needs no card), Cloudflare Workers logs, per-route ErrorBoundary, health endpoint, GitHub Actions (lint + build on push), small test suite for critical paths (auth, send message, post, upload, membership).
P6 MEDIA HARDENING (Telegram)
 Edge Cache API in /api/media, client-side compression + thumbnails, auth + rate limit on upload, keep file_id only, abstract media URLs so R2 swap is config later.
P7 NOTIFICATIONS (APK milestone)
 FCM (free) + Neon outbox + Cloudflare Cron; device_tokens table exists.
P8 SEARCH
 Use existing search_tsv columns (user_posts, communities, community_posts) + GIN indexes -> /api/search for people, posts, communities.
P9 FEED SCALE
 Cursor pagination, tune get_ranked_feed, batch feed_impressions, anon edge cache, hybrid fan-out (outbox + cron -> Redis lists; pull for big accounts).
P10 REALTIME AT SCALE + LOAD TEST
 Shard large communities (multiple DOs / segmented fan-out), batch broadcasts, per-room limits, load test from CI, define paid-upgrade triggers.
P11 AUTH FINISH
 Google OAuth, Email OTP via Resend (free tier), recovery flows, security review with cross-user access tests.

## KNOWN ISSUES
- CommunityView.jsx TDZ crash ("Cannot access 'u' before initialization"): not reproduced in build, find at runtime.
- Real-time community messages show sender as "User". WS clients have no reconnect. Likes only in Redis. supabase.js both statically and dynamically imported (no code split).
- Worker CORS is * (acceptable with bearer tokens).

## NEXT SESSION: START HERE
1. Shadow test in Chrome (cd ~/nakubonye-v2 && npm run dev -- --host, open localhost:5173) with the Cloudflare log stream open. Test DM, group, community, post, like, upload, new sign-up. Paste every [AUTH] and [WS] line (or say none).
2. Neon SQL editor, paste result:
   select count(*) filter (where id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') as non_uuid_users, count(*) as users from "user";
   select count(*) as users_without_profile from "user" u left join profiles p on p.id::text = u.id where p.id is null;
3. Route recon, paste output:
   grep -nE -A16 'path === "/api/(messages|messages/reactions|messages/pinned|posts|likes/list|feed|typing)"' backend/_worker.js | cut -c1-150 | head -170
   grep -rnE "api/typing|\.send\(|type: ?['\"]typing" src | cut -c1-130 | head -15
4. Then Claude writes Phase 1e as one script.

## UPDATE 2026-11-21: ACCOUNT MIGRATION MOVES BEFORE P2
- 6 Better Auth test users have legacy 32-char ids and no profiles; 20 Neon profiles are Supabase-era (uuid) and not linked to any Better Auth login.
- P1.5 (new): import Supabase auth users into Neon "user"/"account" keeping their uuid; users set a new password via Email OTP / reset (needs Resend delivering from noreply@nakubonye.com). Delete the legacy non-uuid test users. Exit: a migrated user logs in and sees their old profile.
- Phase 1b done (GET /api/profile/me returns 409 LEGACY_ACCOUNT_ID for non-uuid users).
- Hardening later (P11): auth.js has trustedOrigins ["*"] and disableCSRFCheck true; fine with bearer tokens only, tighten before cookies or web release.

## P1.6 SIGNUP WIZARD (before P2a-2)
Meta-style one-question-per-screen create-account flow: name, birthday, gender, email, password, OTP code, username (live availability), photo, follow suggestions, welcome. Resumable: signed-in user without a profile row is routed to the wizard. Worker routes done: GET /api/username/available, POST /api/profile/bootstrap (session id only, server-side age gate MIN_AGE, birthday immutable). Next: wizard + Meta-style login UI, profile gate in App routing, Cloudflare Turnstile, rate limits (P1f).

## P1.6b DONE (written 2026-11-21)
Signup wizard (one question per screen, resumable), Meta-style login + forgot-password (Email OTP), profile gate in App routing. Min age 13 (Meta); dating features (Discover/Matches/Likes) to be 18+ only, enforce server-side when those routes move to the Worker. No Supabase calls in these screens. Rule: no new Supabase code anywhere; each screen touched is fully moved to Worker + Neon.

## RESUME HERE (2026-11-21 night)
Order: Worker patches P1e + P2a1 + P1.6 bootstrap (one push, log-only) -> client p16b gate + SignUp/SignIn wizard (build, push) -> Chrome Incognito sign-up test -> Neon check (len 36, has_profile 1) -> shadow logs [AUTH] [WS] [MEMBER] -> set AUTH_ENFORCE=1 and MEMBER_ENFORCE=1 secrets in Cloudflare dashboard after a milestone APK -> Phase 2a-2 inbox: GET /api/inbox replacing ~40 supabase calls in Messages.jsx (lines 95-480 already seen) -> P1f rate limits, Turnstile, validation -> P1.5 Supabase account migration (needs account table columns) -> rest of P2.
Open questions: are the 20 Neon profiles real people? Is the Resend domain verified (OTP emails)? Legacy cleanup SQL: delete non-uuid rows from session, account, user.
Probe: grep markers "PHASE 1: AUTH GATE", "PHASE 1e", "/api/conversations/open", "/api/profile/bootstrap" in backend/_worker.js and "PROFILE GATE" in src/App.jsx.
