# NAKUBONYE SECURITY REMEDIATION PLAN (draft 2026-11-22)
Reviews merged: Copilot (Supabase RLS, Worker), Claude (routes, crash class), DeepSeek (migration patches). Source of truth: git log + this file. No AI's "done" is trusted without evidence.
Goals kept: Meta-level scale, instant UX, zero crashes, security by session identity, Supabase fully removed.

## FACTS
- Better Auth issues opaque session tokens. The app never calls supabase.auth.setSession, so remaining supabase-js calls reach PostgREST as role anon with the public key shipped in the APK (proof: Stage 0).
- A true/true policy exposes a table to its policy roles: anon/public = anyone; authenticated = anyone who can sign up on Supabase Auth if signups are open.
- Neon has no RLS: the Worker is the only gate. With AUTH_ENFORCE/MEMBER_ENFORCE off, routes trust client ids and websocket rooms are open.

## STAGE 0 - EVIDENCE (read-only, in progress)
scripts/audit-supabase-anon.cjs + Supabase SQL Q1-Q4 (roles, no-RLS tables, anon-callable functions, buckets).
Exit: per table we know anon-readable / authenticated-open / signup-open.

## STAGE 1 - CONTAIN LEGACY SUPABASE (needs your approval; backup first)
- Export schema + policies to db/supabase-schema.sql and write a rollback SQL for every change.
- 1a Disable open signups in Supabase Auth if enabled (check the app still never needs supabase.auth.signUp).
- 1b Tables already moved to Neon or unused by the client: replace true/true with deny-all, one table at a time, tested.
- 1c Tables the client still reads via Supabase: migrate the screen first (preferred). Temporary JWT bridge only if a sensitive screen cannot move in time: Worker mints a short-lived Supabase JWT (sub = user uuid, role authenticated) so auth.uid() RLS works; remove at Stage 3.
- SECURITY DEFINER functions callable by anon: revoke execute from anon.
- Storage: make chat-media private; no public listing.

## STAGE 2 - WORKER AUTHORIZATION (code; log-only first, then strict)
- messages / group messages / community messages POST: sender = session user, membership, block and ban checks, field allowlist, length caps.
- reactions + pinned: POST user from session; GET requires conversationId + membership and restricts messageIds to that conversation.
- typing + presence: user = session; roomId requires membership.
- upload: auth, content-type allowlist, size cap, per-user rate limit (Upstash), filename sanitising.
- media proxy: chat/voice media via signed expiring URLs (HMAC) with Cache-Control private; public cache only for public avatars/posts.
- websocket: one-time 60s ticket instead of the session token in the query string; uncached membership check at connect; sockets tagged by userId so kick/ban closes them; membership cache 5-10s plus invalidation on kick/ban/leave.
- zod validation + rate limits on all writes; tighten CORS later.

## STAGE 3 - FINISH CLIENT MIGRATION
Chat.jsx, GroupChat.jsx, CommunityChat.jsx to Worker routes (S3), then remaining screens. node scripts/check-undef.cjs after every patch. Remove supabase-js at the end.

## STAGE 4 - VERIFY, THEN ENFORCE
Authorization test matrix, accounts A, B and an outsider C, run with curl (Termux) and later in CI:
- no token -> 401 on every /api route except ping, auth, media
- A cannot send as B; A cannot read or write B's DM; C cannot join dm/group/community rooms; banned or removed member is denied and disconnected
- reactions/pins cannot cross rooms; typing into a foreign room is denied
- upload without token -> 401; oversize or wrong type -> 4xx
Enforce order: milestone APK (sends tokens) -> AUTH_ENFORCE=1 -> MEMBER_ENFORCE=1; rollback = delete the secret.
Gates: all legit flows clean in the shadow logs, matrix passes, no real users on an old APK.

## STAGE 5 - HYGIENE
Rotate Telegram bot token and Upstash credentials after the review; redact tokens from logs; Sentry; dependency audit; schema exports for both databases in repo (db/neon-schema.sql, db/supabase-schema.sql).

## INTERIM RULE
No real users and no public sharing of the app or Worker URL until Stage 1 and 2 are done.
