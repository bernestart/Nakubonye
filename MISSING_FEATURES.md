# Nakubonye — Missing Features & Actions

Discovered while enforcing privacy settings. Fix after the privacy pass.

Format: `[ ] [source] Feature — where it should live`

---

## From Privacy Enforcement

- [ ] [allow_sharing_to_story] **Share someone else's post to my story** — no flow exists yet
  - Where: PostActionsSheet → "Share to story"
  - What: Opens StoryComposer with the post's image pre-loaded + a link sticker
  - Depends on: `can_share` check (source author's `allow_sharing_to_story`)

- [ ] [who_can_tag] **@mention parser** — StoryEditor currently appends "@" as plain text
  - Where: StoryEditor, PostComposer, Chat
  - What: Detect @username, verify `can_tag`, link to profile, notify

- [ ] [who_can_tag] **Story mentions** — no @mention system inside stories
  - Where: StoryEditor text tool

## From Earlier Audit (carried forward)

- [ ] **Reel Remix** — `remixOf` prop exists on ReelComposer, no entry point in reel actions
- [ ] **Chat Forward** — `alert("Forward coming soon")` in MessageActionsSheet
- [ ] **Chat Pin** — not in message actions
- [ ] **Community share when not a member** — compose is blocked, share isn't offered
- [ ] **Story reply in community** — no flow
- [ ] **Multiple images in reel** — reels allow 1 video only, no carousel

## Placeholder / Mock Only

- [ ] **Audio tracks** — picker works, tracks table is empty, no owned audio files
- [ ] **Voiceover export** — records locally, doesn't mix into the exported reel
- [ ] **Wallet purchases** — Google Play Billing not wired
- [ ] **Coin spending** — boost, super like, pin all reference coins but no spend flow

## Known Gaps From Roadmap

- [ ] **Capacitor wrap** — no native shell yet
- [ ] **Push notifications** — FCM not set up
- [ ] **Email digest**

---

**Rule:** add to this file any time we find something we decide not to fix right now. Revisit after the privacy pass.

## Notifications — whole system missing (table doesn't exist)

- [ ] `public.notifications` table was NEVER created (confirmed via 42P01).
- [ ] `Notifications.jsx` screen exists but reads from a nonexistent table.
- [ ] 7 `notif_*` toggles in `user_settings` are dormant.
- [ ] Plan: create table + triggers + RLS + wire screen. ~3 sessions.
