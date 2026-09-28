# Nakubonye — Master Roadmap

**One app. Dating + Social + Services + Marketplace + Wallet.**

---

## PHASE 1 — Ship v1 (Dating + Social core) → Play Store

**Goal:** The core loop works end-to-end, no crashes, live on Play Store.
**Success:** A stranger can sign up, find someone, match, chat, share a post.

### 1.1 Stabilize (Week 1)
- [ ] Audit every screen for runtime crashes
- [ ] Fix all known bugs (list maintained in BUGS.md)
- [ ] Feed loads without error
- [ ] Stories load, play, expire correctly
- [ ] Reels load, play, autoplay in feed
- [ ] Chat sends/receives reliably
- [ ] Matches logic works (like, match, unmatch)
- [ ] Push notifications scaffold

### 1.2 Mobile wrap (Week 2)
- [ ] Install Capacitor
- [ ] Configure iOS + Android projects
- [ ] Status bar / safe area handling
- [ ] Deep linking scheme (nakubonye://)
- [ ] Native splash screen
- [ ] Hardware back button handled

### 1.3 Assets + content (Week 2)
- [ ] App icon (512×512 + adaptive 432×432)
- [ ] Splash screen (light + dark)
- [ ] Feature graphic (1024×500)
- [ ] At least 6 phone screenshots (1080×1920)
- [ ] Short + full store description
- [ ] Privacy policy hosted at nakubonye.vercel.app/privacy
- [ ] Terms of Service hosted
- [ ] Content rating questionnaire

### 1.4 Play Store (Week 3)
- [ ] Google Play Developer account ($25)
- [ ] Create app listing
- [ ] Generate signed AAB
- [ ] Upload to Internal Testing
- [ ] Test with 5–10 users
- [ ] Fix feedback
- [ ] Promote to Closed → Open → Production

### 1.5 Post-launch (Week 4)
- [ ] Crash reporting (Sentry free tier)
- [ ] Analytics (Plausible or Umami)
- [ ] Feedback loop (in-app form)
- [ ] Iterate on top 3 complaints

---

## PHASE 2 — Services + Marketplace

**Goal:** Users can offer and buy services, list and buy items.
**Success:** A stranger can post a service, someone else can book and pay.

### 2.1 Services (money-for-time) — FIRST
**Why first:** Two-person transaction. Simpler than physical goods. Fits dating app trust model.

- [ ] Database tables: `services`, `service_bookings`, `service_reviews`
- [ ] Storage bucket: `service-media`
- [ ] UI: Services list inside Discover → new tab
- [ ] Create service flow: title, category, price, photos, availability
- [ ] Browse + filter by category, location, price
- [ ] Book a service: pick date/time, optional notes
- [ ] In-app chat negotiation (reuse existing chat)
- [ ] Reviews after completion
- [ ] Payout scaffold (manual initially)

### 2.2 Marketplace (physical goods) — SECOND
**Why second:** Needs logistics, disputes, shipping.

- [ ] Database tables: `listings`, `orders`, `listing_reviews`
- [ ] Storage bucket: `listing-media`
- [ ] UI: Marketplace list inside Discover
- [ ] Create listing: title, category, price, condition, photos, location
- [ ] Browse with filters
- [ ] Saved/favorite listings
- [ ] Message seller (reuse chat)
- [ ] Order flow: reserve → pay → ship → confirm
- [ ] Dispute flow
- [ ] Delivery options (pickup / courier — scope TBD)

### 2.3 Unified "Discover" screen
- [ ] Sub-tabs: People · Services · Marketplace · Community
- [ ] Search across all
- [ ] Location filter

---

## PHASE 3 — Wallet + Monetization

**Goal:** Users can earn and spend in-app currency. Nakubonye takes a cut.
**Success:** Real revenue.

### 3.1 Nakubonye Coins
- [ ] Table: `wallets` (user_id, balance, updated_at)
- [ ] Table: `transactions` (user_id, amount, type, ref_id, created_at)
- [ ] Buy coins: Google Play Billing (required for Play Store digital goods)
- [ ] Coin packages: 100 / 500 / 2000 / 10000
- [ ] Wallet screen (in Profile menu)

### 3.2 Coin spending
- [ ] Boost your profile (24h visibility bump)
- [ ] Super Like (stand out in match queue)
- [ ] Pin a post (24h at top of feed)
- [ ] Send a gift in chat
- [ ] Unlock "See who liked you"
- [ ] Extra story slot

### 3.3 Creator monetization (when eligible)
- [ ] Creator tier system (followers threshold)
- [ ] Tips in chat
- [ ] Paid subscriptions to a creator
- [ ] Paid DMs
- [ ] Platform fee (15–20%)
- [ ] Payout system (Stripe Connect or manual)

### 3.4 Business accounts
- [ ] Service provider tier
- [ ] Marketplace seller tier
- [ ] Promoted listings (coins → boost)
- [ ] Analytics dashboard

---

## PHASE 4 — Polish + Scale

### 4.1 Quality
- [ ] Push notifications (FCM)
- [ ] Email digest
- [ ] Offline mode
- [ ] Performance: feed <1s, chat <300ms
- [ ] Accessibility pass
- [ ] Localization (EN, RW, FR, SW)

### 4.2 Growth
- [ ] Referral system (invite → both get coins)
- [ ] Deep links (share profile, post, service)
- [ ] SEO for public pages
- [ ] Web landing page

### 4.3 Trust + safety
- [ ] Report + block (mostly exists)
- [ ] Photo verification (selfie check)
- [ ] Moderation queue for services/listings
- [ ] Scam detection

---

## RULES

1. **Ship Phase 1 before Phase 2.** No exceptions.
2. **No marketplace until 100 active users.** Empty marketplaces kill apps.
3. **Monetize after 1000 users.** Free growth first.
4. **One new feature per week max.** Protect quality.
5. **Every feature = DB table + UI + tests + store asset.**

## CURRENT STATUS

- Phase: **1.1 — Stabilize**
- Blocker: fixing crashes + bug list
- Next action: audit every screen
