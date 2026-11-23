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
5. APK builds in CI. Every git push to main: (a) auto-deploys Worker via Cloudflare, (b) triggers GitHub Actions Android build → downloadable from Actions run artifacts. NO local gradlew. Milestone APK = the latest Actions artifact at that commit.
6. GitHub Actions workflow (.github/workflows/android-build.yml) builds the debug APK on every push. Download from: GitHub repo → Actions → latest run → Artifacts → app-debug.apk. Same artifact is what users install — no Termux gradle needed.
7. Free only: no service that needs a payment method until revenue (R2 deferred).
8. Never paste secrets or tokens.

## CURRENT ARCHITECTURE (facts from audit)
- React 19 + Vite + Capacitor 8 (Android). Worker backend/_worker.js on Cloudflare (auto-deploy from GitHub main). Neon Postgres via HTTP /sql, Upstash Redis (presence, likes), Telegram Bot API media proxy (/api/media, 20 MB cap), Better Auth (backend/auth.js) with bearer tokens, Supabase still used by ~1,246 call sites.
- One Durable Object class ChatRoomSQLite (hibernation API). Rooms: DM = dm-<conversationId> (bigint), group = group-<groupId> (uuid), community = <communityId> (bare bigint). WS URL /api/ws/<room>?token=...
- IDs: app tables uuid; Better Auth user.id is text (uuid-shaped via randomUUID). ~130 Neon tables, only function get_ranked_feed. All communities are privacy=public. Likes live only in Redis.
- Membership: DM = conversations.initiator_id/recipient_id or linked matches(user_one_id,user_two_id); group = group_members; community = community_memberships minus community_bans. blocks table exists, unchecked.

## STATUS
- P0 done (tag baseline-1). P1 applied + pushed in LOG-ONLY mode (scripts/p1-auth-gate.cjs, tag pre-p1); not yet shadow-tested.

## PHASES (each has measurable exit test; ordered by bottleneck removal)

### P1 — AUTH ENFORCEMENT (blocker)
**Sub-phases:**
- **P1a-1d DONE (log-only):** Worker session check, whoami route, WS token + upgrade-only, DO frame filter, client fetch wrapper (src/lib/authFetch.js).
- **P1e (pending):** Shadow test in Chrome (7-step sequence, all 3 chat types + feed + profile).
- **P1f (expand):** Rate limits (Upstash) + **idempotency keys** (X-Idempotency-Key: <uuid>, 60s cache, return cached response on retry) + Turnstile on signup + zod input validation + authenticated upload.
- **P1g (NEW):** Flip `AUTH_ENFORCE=1`, `MEMBER_ENFORCE=1`, `MESSAGES_ENFORCE=1` in Cloudflare env vars; monitor 24h; documented rollback plan.

**Tool cost:** $0 (Upstash free tier).
**Exit:** no token → 401; user A cannot act as user B; non-member cannot post in DM/group/community; bot posting 100×/min gets 429 after 30; duplicate POST with same idem key returns same response.

### P1.5 — ACCOUNT MIGRATION (keep)
6 Better Auth test users have legacy 32-char ids and no profiles; 20 Neon profiles are Supabase-era (uuid) and not linked to any Better Auth login. Import Supabase auth users into Neon "user"/"account" keeping their uuid; users set new password via Email OTP (needs Resend from noreply@nakubonye.com). Delete legacy non-uuid test users.
**Exit:** migrated user logs in and sees old profile.

### P1.6 — SIGNUP WIZARD (DONE)
Meta-style one-question-per-screen create-account flow: name, birthday, gender, email, password, OTP code, username (live availability), photo, follow suggestions, welcome. Resumable. Worker routes done: GET /api/username/available, POST /api/profile/bootstrap (session id only, server-side age gate MIN_AGE=13). Profile gate in App routing done. Turnstile + rate limits move to P1f.

### P2 — SINGLE SOURCE OF TRUTH (largest)
**Order:** profiles/follows/photos → DM/group/community chat → posts/comments/likes → stories → reels → notifications/settings/matches → marketplace/services/events → admin.
**T1 status (DONE 2026-11-23):** Chat.jsx (23→0), Messages.jsx (13→0), ProfileView.jsx (43→0), Feed.jsx (47→0). Verified statically. Runtime verification pending P1e Chrome test.
**Ports done:** 8 of ~25 Supabase RPCs (can_view_profile, can_see_location, can_send_request, record_profile_view, decline_like, like_user, get_suggested_reels, get_pymk_profiles). All with explicit `me uuid` first arg — no auth.uid().
**Ports remaining:** ~17. Order per T2/T3 file priority.
**Tool:** no new tools. Reuses Workers + Neon.

### P2.5 (NEW) — CACHING LAYER (at end of P2)
**Tool:** Upstash Redis (already paid for, ~$1/mo beyond free).
**Content:** Cache /api/feed/v2 (30s TTL, per user), /api/profile/view (60s TTL, per target), /api/profiles/bulk (300s TTL, by id set). Cache-Control headers. Invalidation on write (message send → bust feed/v2 for sender + recipient).
**Exit:** 80% cache hit rate on feed/v2; p95 latency drop 40%+.

### P3 — REALTIME HARDENING
**Tool:** shared WS hook with reconnect/backoff/dedupe.
**Content:** offline send queue, typing via WS frames, read receipts, persist likes to Neon user_post_likes (Redis as cache), community messages join sender name, remove hardcoded Worker URL.
**Exit:** airplane-mode toggle mid-chat loses no messages.

### P3.5 (NEW) — BACKGROUND JOBS
**Tool:** Cloudflare Queues (included in Workers Paid, 10M ops/mo, ~$5/mo).
**When:** notification dispatch (currently synchronous in notifyReaction), feed fanout at 100k+ DAU, media processing, email batching.
**Content:** Worker Queue producer + consumer. Replaces synchronous awaits where fire-and-forget is acceptable. Retry on failure with exponential backoff. Depth visible in Cloudflare dashboard.
**Exit:** notification POST returns <50ms (async dispatch); queue depth <100 sustained; consumer retries on failure.

### P4 — INSTANT UX
**Tool:** TanStack Query (already installed per imports), client-side lazy loading.
**Content:** cached feed/profile/chat (stale-while-revalidate), optimistic send/like/comment with rollback, lazy routes, skeletons, remove window.location.reload.
**Exit:** feed shows from cache <100ms; initial JS <300KB gzip.

### P5 — OBSERVABILITY + CI (expanded)
**Tools:** Sentry (free: 5k errors/mo, app+Worker), Grafana Cloud (free: 50GB logs, 14 days), Cloudflare Logs → Logpush → R2 → Grafana.
**Content:** structured JSON logs on every route (`{route, status, ms, userId, err?}`), per-route ErrorBoundary, health endpoint, GitHub Actions lint+build on push, alert thresholds (error rate >2%, p95 >2000ms), small test suite (auth, send message, post, upload, membership).
**Exit:** every 5xx traceable via Grafana <1 min; alert fires before users report; Sentry tracks each error with stack + context.

### P6 — MEDIA HARDENING
**Tool:** Telegram proxy (current, free) → Cloudflare R2 at 50k DAU or 100GB storage.
**Content:** Edge Cache API in /api/media, client compression + thumbnails, auth + rate limit on upload, keep file_id only, abstract media URLs so R2 swap is env var.
**Exit:** upload authenticated + rate-limited; media loads <500ms p95; R2 swap is one env var.

### P7 — NOTIFICATIONS
**Tools:** FCM (free), Cloudflare Queues (from P3.5), Cloudflare Cron, Neon outbox.
**Content:** device_tokens table (exists), outbox table, Cron every 30s drains outbox → FCM, batching to reduce API calls.
**Exit:** push delivered <5s after event; failed pushes logged to Grafana; no duplicate pushes on retry.

### P8 — SEARCH
**Tool:** Postgres full-text (tsvector + GIN indexes) — already in schema.
**Content:** existing search_tsv columns (user_posts, communities, community_posts) → /api/search for people, posts, communities. Trigram for fuzzy.
**Trigger:** only when Postgres GIN queries exceed 100ms p95.
**Exit:** search returns <200ms p95; empty query returns suggestions.

### P9 — FEED SCALE
**Tool:** existing Upstash cache (from P2.5) + Cloudflare Cache API (edge variants).
**Content:** cursor pagination (partial: /api/feed/v2 + loadMore done), tune get_ranked_feed, batch feed_impressions, anon edge cache, hybrid fan-out (outbox + cron → Redis lists; pull for big accounts).
**Entrance:** load test 100 req/s × 5 min, p95 <500ms, error rate <1%.
**Exit:** feed loads <300ms p95 at 10k RPM; no Neon write queue backlog.

### P10 — REALTIME AT SCALE + LOAD TEST
**Tool:** Cloudflare Durable Objects sharding, per-room batching.
**Content:** shard large communities (multiple DOs / segmented fan-out), batch broadcasts, per-room limits, load test from CI, define paid-upgrade triggers (DO ops >8M/mo → shard).
**Exit:** 100k concurrent WS, <100ms broadcast latency, no DO overload.

### P11 — AUTH FINISH
**Tool:** Google OAuth, Resend (free: 100/day).
**Content:** Google OAuth, Email OTP via Resend, recovery flows, cross-user security review, tighten trustedOrigins (currently "*").
**Exit:** OAuth works end-to-end; recovery completes; security review finds zero cross-user leaks.

### P12 (NEW) — CAPACITY GUARDRAILS
**When:** continuously, before any growth push.
**Tools:** Upstash Ratelimit (P1f), Cloudflare Workers Analytics, Neon monitoring.
**Content:** per-route cost tracking, monthly budget alerts, auto-disable non-critical routes if cost overrun, capacity planning doc (DAU/capacity headroom).
**Exit:** dashboard shows current DAU, requests/mo, cost/mo, next bottleneck; alerts fire at 70% of any free-tier limit.

---

## PHASE ORDER — WHAT BLOCKS WHAT

```
P1 (auth) → P1f (rate+idem) → P1g (flag flip) → P2 (supabase purge) → P2.5 (cache)
     ↓
P3 (realtime) → P3.5 (queues) → P4 (instant UX) → P5 (observability)
     ↓
P6 (media) → P7 (notifications) → P8 (search)
     ↓
P9 (feed scale) → P10 (realtime scale) → P11 (auth finish) → P12 (guardrails, continuous)

P1.5, P1.6 independent, mostly done.
```

## TOOL-TO-CAPABILITY MAP

| Capability | Tool | Phase | Free tier limit | Paid cost |
|---|---|---|---|---|
| API compute | Cloudflare Workers | current | 100k req/day | $5/mo → 10M |
| Database | Neon Postgres | current | 0.5GB | $19/mo → 10GB |
| Cache | Upstash Redis | current | 10k cmd/day | ~$1/100k |
| Realtime | CF Durable Objects | current | workers paid only | $5/mo base |
| Auth | Better Auth + Neon | current | unlimited | $0 |
| Media | Telegram → R2 | P6 | Telegram free / R2 10GB | $0 → $1.50/100GB |
| Background jobs | Cloudflare Queues | P3.5 | workers paid only | $5/mo (10M ops) |
| Observability | Grafana Cloud + Sentry | P5 | 50GB / 5k errors | $0 |
| Search | Postgres FTS | P8 | included | $0 |
| Push | FCM | P7 | unlimited | $0 |
| Email | Resend | P11 | 100/day | $20/mo → 50k |

## CAPACITY PER STAGE

| DAU | Monthly cost | Bottleneck removed next |
|---|---|---|
| 0→1k | $5 | Do nothing — current stack fine |
| 1k→10k | $5-15 | P1f+P1g (rate limits, enforcement), P5 (observability) |
| 10k→50k | $20-30 | P2.5 (caching), P3.5 (background jobs) |
| 50k→200k | $50-100 | P6 (R2 migration), P9 (feed caching) |
| 200k→1M | $150-300 | P10 (DO sharding), Neon read replicas |
| 1M→10M | $1k-5k | Sharding by user_id, CQRS for messages |
| 10M+ | $10k+ | Custom infrastructure (Meta-level) |

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

## S1 STABILIZE (2026-11-22) after audit of DeepSeek patches
git log is the source of truth. Found: Chat.jsx used supabase without import (crash) -> import restored as stop-gap; /api/inbox/action used undefined req -> fixed; new routes (inbox/*, chat/*, messages/action) now always require a session and ids must equal the session user; messages/action rewritten (participant check, array_append); conversations/adopt disabled (use /api/conversations/open). DO NOT run the profile BFF script (route name collides with POST /api/profile/bootstrap; SELECT * leaks lat/long and private settings). Next: move remaining supabase calls in Chat.jsx and Messages.jsx, then profile screen via new /api/profile/view with column whitelist + block + visibility checks.

## S2 (2026-11-22)
GET /api/inbox (session identity, one response for the Messages list); Messages.jsx load now one request; chat/permissions requires sender = session user. Messages.jsx still on Supabase: markAllRead, pin/archive/mute/delete actions, block, stories row, realtime channel (dead: messages live in Neon). Chat.jsx still has ~25 supabase calls. Guard: run node scripts/check-undef.cjs after every patch.

## RESUME HERE (2026-11-23)
**T1 COMPLETE:** Chat.jsx, Messages.jsx, ProfileView.jsx, Feed.jsx = 0 supabase refs (verified check-undef + build). Worker endpoints live: /api/feed/v2, /api/feed/loadMore, /api/feed/{impression,click,notify,poll}, /api/profile/{view,actions,connections}, /api/inbox/{read,action}, /api/messages/action, /api/conversations/timer, /api/stories.
**Neon functions ported:** get_suggested_reels, get_pymk_profiles, can_view_profile, can_see_location, can_send_request, record_profile_view, decline_like, like_user (all with explicit `me uuid` first arg replacing auth.uid()).
**Pending runtime test:** Chrome 7-step sequence (feed loads, like, click→chat, profile, messages list, open conv, send message). All T1 changes verified statically only.
**Enforcement flags (P1g):** AUTH_ENFORCE, MEMBER_ENFORCE, MESSAGES_ENFORCE all unset in Cloudflare — flip after Chrome test passes.
**Next:** Chrome test → P1g flag flip → P1f rate limits + idempotency → P5 observability → P2.5 cache → T2/T3 supabase cleanup.
**Open questions:** are the 20 Neon profiles real people? Is the Resend domain verified? Legacy cleanup SQL: delete non-uuid rows from session, account, user.


## CURRENT STATUS — UPDATED 2026-11-23
**T1 COMPLETE.** Chat.jsx, Messages.jsx, ProfileView.jsx, Feed.jsx = 0 supabase calls (verified via check-undef + build). Worker routes served: /api/feed/v2, /api/feed/loadMore, /api/feed/{impression,click,notify,poll}, /api/profile/{view,actions,connections}, /api/inbox/{read,action}, /api/messages/action (edit), /api/conversations/timer, /api/stories.
**Neon functions ported:** get_suggested_reels, get_pymk_profiles, can_view_profile, can_see_location, can_send_request, record_profile_view, decline_like, like_user (all with explicit `me uuid` first arg replacing auth.uid()).
**Not yet verified at runtime** — Chrome test still owed.
**Enforcement flags still log-only:** AUTH_ENFORCE, MEMBER_ENFORCE, MESSAGES_ENFORCE all unset in Cloudflare. Flip only after Chrome test passes.
**Next:** Chrome test (7-step sequence) → flip flags → rate limits → idempotency → Phase 5 observability → T2 supabase cleanup.
