# Nakubonye roadmap (audit-driven). One phase = commit + tag, build passes, device test, then next.
P0 Baseline: commit, tag, no tracked secrets, remote backup, db/schema.sql in repo.
P1 Auth enforcement (blocker):
 1a client sends Bearer on every Worker call; WS token
 1b Worker verifies session on every /api/* (except ping, auth, media GET); user id comes from session, never body
 1c WS upgrade requires session + membership; stop rebroadcasting client frames
 1d Upstash rate limits + zod validation on writes; restrict CORS
 Exit: no token -> 401; user A token cannot act as user B
P2 Single source of truth: inventory Supabase usage; move profiles/follows -> DM/group/community chat -> stories/reels -> rest; remove supabase-js + jsonwebtoken. Exit: grep supabase src = 0
P3 Realtime hardening: shared WS hook (backoff, dedupe, resume), DO close-code fix, likes persisted in Neon
P4 Instant UX: TanStack Query + optimistic send/like, lazy routes (2.1MB bundle -> <600KB initial)
P5 Observability + CI: Sentry (app + Worker), GitHub Actions build/lint/deploy
P6 Media to R2
P7 Notifications (FCM) · P8 Search · P9 Feed fan-out · P10 Load test
