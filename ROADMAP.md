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

<!-- T3.5-STATUS-START -->
## 🚧 T3.5 — SUPABASE PURGE STATUS (auto-generated, do not hand-edit)

**Last updated:** 2026-11-27
**Purpose:** Handoff context for any AI or engineer continuing the migration. Read this BEFORE making changes.

### Current state

| Metric | Start T3.5 | Now |
|---|---|---|
| Supabase calls in `src/` | 635 | ~541 |
| Worker endpoints in `backend/_worker.js` | 37 | 64 |
| Files fully clean (0 supabase calls) | 4 | 12+ |
| Batches shipped | 0 | 12 (01a–01k + 02/02b) |
| Reverts needed | 0 | 0 |

### Batches shipped (append-only history)

| Batch | Scope | Result | Endpoints added |
|---|---|---|---|
| 01a | Settings (6 files: NotificationSettings, PrivacySettings, MutedWords, MutedUsers, BlockedList, MessagingSettings) | 7 calls killed | +6 |
| 01b | Settings cont. (MessagingSettings Promise.all, BlockConfirm, usePresence, MutedUsers bulk) | 10 calls killed | +6 |
| 01c | story_hides + connections aggregation + profiles-photos extend | 7 calls killed | +2 |
| 01d | ProfileConnections RPCs (get_suggested_people, like_user) + ProfileEditSheet music_genres | 3 calls killed | +3 |
| 01e | Preview.jsx 10-query Promise.all → 1 endpoint + toggle_creator + interests + reels bulk | 13 calls killed | +3 |
| 01f | Preview.jsx post stats (personal + community reactions/comments) | 4 calls killed | +1 |
| 01g | Preview.jsx dynamic table reaction toggle (fully clean) | 2 calls killed | +1 |
| 01h | ProfileEditSheet details → /api/profile/me PATCH (fully clean) | 1 call killed | 0 (reuse) |
| 01i | dataExport.js 18-call Promise.all → /api/user/data-export (fully clean) | 18 calls killed | +1 |
| 01j | Admin.jsx 22 admin_* RPCs → /api/admin/rpc proxy | 22 calls killed | +1 |
| 01k | Admin.jsx app_config + dynamic soft-delete | 2 calls killed (2 remain: storage signed URL + post_reports) | +2 |
| 02/02b | notifSync + deviceToken + AppHeader cleanup + device_tokens endpoints | 6 calls killed | +2 |

### Batches remaining (queue)

| # | Scope | Files | Est. calls | Status |
|---|---|---|---|---|
| 03 | Communities + groups | ~18 | ~76 | ⏳ next |
| 04 | Marketplace + services + events | ~15 | ~40 | ⏳ queued |
| 05 | Stories + reels + drafts | ~12 | ~28 | ⏳ queued |
| 06 | Verification + monetization + rewards | ~8 | ~30 | ⏳ queued (uses /api/admin/rpc pattern) |
| 07 | Auth (passkeys + Brevo OTP) | ~8 | ~14 | ⏳ final — needs BREVO_API_KEY in .env |
| 01l | EditProfile.jsx (storage + albums) | 1 | 13 | 🚫 deferred — file migration decision needed |
| 01m | Admin.jsx (signed URL + post_reports tail) | 1 | 2 | 🚫 deferred — file migration + re-audit |

### Auth decision (locked)

- **Primary:** **Passkeys (WebAuthn)** — free forever, no SMS fees, scales to billions
- **Fallback:** **Brevo** email OTP — 300/day free, ~9k/mo, **no custom domain required** (verify a single sender email like `you@gmail.com`)
- **Scale flip:** Buy `nakubonye.com` (~$10/yr) once volume exceeds 300 signups/day → swap to Resend/SES ($0 at that volume) → keep Brevo code path as backup
- **Rejected:** Resend without domain (owner-only), Phone/SMS (costs $5k–50k/mo at scale)

### Workflow conventions (do not violate)

1. **Every patch uses `fetch()`** — `src/lib/authFetch.js` monkey-patches `window.fetch` to inject Bearer token for `API_BASE_URL` calls. No per-callsite auth needed.
2. **Never run `npm run build` locally** — GitHub Actions builds the APK on push. Flow: dry-run → apply → `npx vite build` (compile check) → commit → push.
3. **Anchor-based patches only** — `node batch-XXX.cjs --dry-run` first. Abort on any `❌ anchor not found` or `❌ anchor ambiguous`. Never partially apply a file.
4. **Endpoint insertion point** — always insert new routes in `backend/_worker.js` before the final tail:
   `return new Response(JSON.stringify({ success: true, message: "Nakubonye API Gateway is Live" }), ...)`
5. **Endpoint numbering** — sequential in comments (currently at #47 in `_worker.js`).
6. **URL pattern** — `fetch(`${API_BASE_URL}/api/...`)` — `API_BASE_URL` from `src/lib/api`. Never hardcode `nakubonye.bernestart.workers.dev`.
7. **Never ask for `.env` contents** — use `import.meta.env.VITE_*` on frontend, `env.*` bindings on Worker.
8. **One batch = one commit + push** — keeps builds reviewable, rollback trivial (`git revert HEAD`).

### Known-good recent commits

- `3f2d05c` feat: production release — WebRTC calls, rate limiting, OTP auth, BFF migrations
- `b82bec0` feat(security): add Upstash Redis rate limiting for API, Auth, and Messages
- `3630b05` fix(security): move rate limiter to the top of request lifecycle
- `04879e8` feat(settings): batch-01a — 7 calls to endpoints

### If you are a new AI picking this up

1. Read this whole block first.
2. Run `grep -rcE 'supabase\s*\.\s*(from|rpc)' src/ | awk -F: '{s+=$2} END {print s}'` — compare against **~541** above. If it doesn't match, work has happened since this was written — audit before patching.
3. Continue from the **next uncompleted batch** in the queue table.
4. If a batch's anchors fail 3× — do `sed -n 'L1,L2p' file | cat -A` dump of the region and rewrite the regex against real bytes (not what you remember).
5. **Never assume a file is clean** based on prior audits — re-grep before patching.

<!-- T3.5-STATUS-END -->
