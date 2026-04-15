# Orbit42 — Launch Checklist

Pre-flight checks before announcing the service publicly. Run through each
section with a real test account (not the historical `leo` seed — rotate it
first via `20260416000000_rotate_seed_admin.sql`).

> 🎯 Definition of "done": every box checked, no console errors in the
> browser during the happy path, no 500s in Vercel logs for 24h.

---

## 0. Environment

- [ ] Supabase migrations up to `20260416200000_token_cleanup.sql`
  applied on prod DB.
- [ ] Vercel production env vars set:
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`,
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
  `RESEND_API_KEY`, `RESEND_FROM`, `CRON_SECRET`.
- [ ] Google Cloud OAuth consent screen switched from Testing → In
  production (or verified scopes).
- [ ] Resend domain `mail.orbit42.org` DNS verified (DKIM/SPF green).
- [ ] `vercel.json` crons show in Vercel Dashboard → Cron Jobs with a
  recent successful execution for both `/api/cron/cleanup` and
  `/api/cron/auctions`.
- [ ] Rotate any API keys ever pasted in chat / screenshots.

---

## 1. Auth

### Email signup
- [ ] Sign up with a fresh email/username/password.
- [ ] Land on `/feed` automatically.
- [ ] Settings shows amber "이메일 확인이 필요해요" banner.
- [ ] Verification email arrives within 30s from `noreply@mail.orbit42.org`.
- [ ] Clicking the link → `/verify-email?token=…` shows success card.
- [ ] Refresh Settings — banner is gone.

### Password reset
- [ ] "비밀번호를 잊으셨나요?" on landing → enter email → see success state.
- [ ] Reset email arrives.
- [ ] Link opens `/reset-password?token=…` — set new password (6+ chars,
  confirm field must match).
- [ ] Redirects to `/login?reset=1` with green banner.
- [ ] Log in with new password succeeds.
- [ ] Try the reset link a second time — must fail with "이미 사용된".

### Google sign-in
- [ ] Landing → "Continue with Google" → OAuth screen → return.
- [ ] Land on `/feed` with a freshly-created or matched-by-email account.
- [ ] Settings shows email as **확인됨** for Google-signup paths.
- [ ] Disconnect Primary Google from Settings → `/calendar` picker no
  longer lists the Google calendar.
- [ ] Re-connect Google → Google calendar rows re-appear in picker.

### Rate limits
- [ ] Rapid-fire 10+ wrong logins → 9번째쯤 "너무 많은 시도" 에러.
- [ ] Rapid-fire 5+ signups from same IP → throttle kicks in.
- [ ] Rapid-fire 5+ forgot-password with same email → always returns
  success (fail-silent) and email inbox confirms we didn't spam.

### Account delete
- [ ] Settings → 계정 삭제 → type username → confirm → land on `/`.
- [ ] Try to log in again with the old credentials — fails.
- [ ] Former profile URL `/[username]` returns 404.
- [ ] Bookings/slots/calendars owned by that user gone (cascade).

---

## 2. Calendar

- [ ] `/[username]/calendar` loads with week grid + all-day lane visible.
- [ ] Today column is highlighted.
- [ ] Picker lists **내 캘린더** (native default) and any synced Google
  calendar (primary only, no subscribed feeds).
- [ ] Unchecking every calendar → grid empties.
- [ ] Adding a new native calendar in Settings → Picker refreshes.
- [ ] Creating a new event with a specific calendar → appears in week
  view colored by that calendar.
- [ ] Public calendar event appears on personal feed + follower feeds.
- [ ] Private calendar event does NOT appear on feed (verify from
  another account).
- [ ] Mobile (≤375px): horizontal swipe through days works, events
  readable, all-day lane not squished.

---

## 3. Timeslots

### Create
- [ ] New slot with each mode: manual + fixed price, manual + free, auto,
  auction.
- [ ] For a paid slot on a private calendar → blocked with warning.
- [ ] Set 판매 기간 = 1개월 → slot is only bookable within that window.
- [ ] 직접 확인 (auto_approve=false) → new bookings come in as 대기.
- [ ] 자동 수락 → new bookings come in as 확정.
- [ ] Add services (Menus page) → attach to slot → verify slot detail
  shows "포함되는 서비스" list.

### Edit / delete
- [ ] Edit any field on an existing slot — saves.
- [ ] Pause a slot — removed from public grid + /book.
- [ ] Delete a slot — removed everywhere; existing bookings remain.

### Public view
- [ ] `/[username]/s/[slug]` shows calendar-first picker with remaining
  count badge on multi-capacity slots.
- [ ] Selecting an unavailable date does nothing / is disabled.
- [ ] OG preview (paste URL in Slack/KakaoTalk) renders the branded
  card with title, price, host.

### Booking happy path (logged-in)
- [ ] Pick date + time + (optionally) services.
- [ ] Total price updates live.
- [ ] Submit → success screen.
- [ ] For free slots → goes straight to 완료.
- [ ] For paid slots → 결제 확인 step → checkbox + 예약 확정.
- [ ] Host receives "새 예약" email.
- [ ] Guest receives "예약 확정" email when auto-approved or after host
  approval.
- [ ] Times in both emails match the displayed KST times.

### Booking happy path (logged-out)
- [ ] On slot page without login → form shows name + email hint.
- [ ] Submit → success. Receive guest email with confirmation.
- [ ] Host inbox shows the guest with name + email.

### Host inbox
- [ ] `/bookings` 받은 예약 tab lists new booking with status badge.
- [ ] Selected services render as pills below the guest label.
- [ ] Accept → status → 확정, guest email sent.
- [ ] Cancel → status → 취소, guest email sent.
- [ ] 완료 works for confirmed bookings.

### Guest inbox
- [ ] 내가 한 예약 tab lists the booking.
- [ ] Location + host link clickable.
- [ ] 취소 button on upcoming booking → status → 취소 for both sides,
  host gets notification email.

### Auction
- [ ] Create auction slot with 1-hour ends_at for testing.
- [ ] Place a bid from another account.
- [ ] Wait past the end time (or manually GET `/api/cron/auctions`
  with `?key=<CRON_SECRET>`).
- [ ] Slot flips to inactive.
- [ ] Winning bidder has a confirmed booking in `내가 한 예약`.
- [ ] Both sides receive emails.

---

## 4. Feed & Social

- [ ] Compose a feed post → appears in Feed + profile "내가 쓴 글".
- [ ] Delete a feed post (owner only).
- [ ] Reactions work on feed post + slot + blog post.
- [ ] Explore lists active users with avatars, Orbit button inline.
- [ ] Click Orbit → follow state toggles; refresh persists.

---

## 5. Legal / Brand

- [ ] Landing footer links to `/terms` and `/privacy` (both reachable
  logged-out).
- [ ] Copyright reads `© 2026 N.THING Inc.`
- [ ] `connect@nthing.net` appears only inside legal pages.
- [ ] 404 page branded with Orbit42 logo.
- [ ] 403 page branded with Orbit42 logo.

---

## 6. Security spot-checks

- [ ] `supabase/migrations/20260416100000_enable_rls.sql` applied — run
  `select tablename, rowsecurity from pg_tables where schemaname='public'`
  and confirm `true` for time_slots, bookings, calendars, events,
  feed_posts, menus, slot_menus, bids, reactions, token tables.
- [ ] Log in as user A, open DevTools Network tab, manually POST to
  `/api/cron/cleanup` → 401.
- [ ] Try a password reset token a second time → rejected.
- [ ] As user A, call `cancelMyBooking` with user B's booking id via
  a devtools replay — should fail (server re-checks guest_id).
- [ ] No unexpected env vars visible in browser bundle — run
  `curl https://orbit42.org | grep -i "sk_"` etc.

---

## 7. Performance

- [ ] Lighthouse mobile Performance ≥ 80 on landing.
- [ ] `/[username]` profile loads < 2s.
- [ ] `/[username]/calendar` first paint < 3s.
- [ ] No N+1 warnings in Vercel logs.

---

## 8. Observability

- [ ] Vercel Logs retention verified (≥ 1 day plan).
- [ ] Trigger one known error (e.g., bad token) and confirm it lands in
  logs with context.
- [ ] Resend dashboard shows transactional send volume matching tests.
- [ ] Supabase dashboard usage well under plan limits.

---

## 9. Rollback plan

- [ ] Supabase point-in-time recovery enabled (verify in plan).
- [ ] Previous Vercel deployment pinned (can be re-promoted from
  Deployments tab).
- [ ] `.env.local` equivalent backed up somewhere safe.

---

When all boxes are green and a smoke test from a virgin browser
(incognito, no extensions) works end-to-end, ship it. 🚀
