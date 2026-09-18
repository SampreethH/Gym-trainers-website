# Elevate OS

## Luxury Fitness SaaS — Production Specification

**Version:** 1.0  
**Status:** Architecture baseline for implementation  
**Product:** Multi-tenant training OS for independent trainers and their GT / PT clients  
**Quality bar:** Premium consumer product (restraint, typography, motion, and precision). Fitness identity is original; do not copy third-party visual systems.

This document is the source of truth for system architecture, data model, authorization, APIs, subscription enforcement, UI/UX for all four roles, 3D landing behavior, and the implementation roadmap.

---

## 1. Product definition

Elevate OS is a trainer-led fitness operating system. Trainers subscribe to the platform. Clients never pay Elevate directly; they are invited into a trainer’s tenant. Access is role-scoped and enforced on the server. Trainers with lapsed or failed billing lose all product surfaces immediately.

### 1.1 Roles

| Role | Who | Primary job | Tenant scope |
|---|---|---|---|
| `gt_client` | Group training member | Pick a date, execute the trainer’s plan (exactly 5 variations per muscle group), complete each set, earn a certificate, share socially | Assigned trainer tenant |
| `pt_client` | Personal training member | Run Cardio or Strength programs, edit profile/metrics/photos, book slots, track progress | Assigned trainer tenant |
| `trainer` | Independent coach (tenant owner or staff) | Monitor clients, author plans, message, track no-shows, live session status | Own tenant only; requires **active subscription** |
| `platform_admin` | Elevate operator | Users, recovery, trainer billing, tiers, analytics, multi-trainer ops | Platform-wide; no unnecessary PHI |

GT and PT are **program types**, not separate identity providers. A user has one primary program per tenant. A trainer may convert a client GT ↔ PT; conversion is audited.

### 1.2 Non-negotiable product rules

1. **Complete Set is mandatory.** A set row is invalid until the client taps Complete Set. Incomplete rows are excluded from totals, certificates, streaks, and trainer “completed” status.
2. **Five variations, not more.** Each scheduled muscle group exposes exactly five exercise variations. The API rejects plans that violate this invariant.
3. **Trainer access requires an active Stripe subscription** (or equivalent). Failed payment or lapse triggers immediate feature revoke via webhook + middleware.
4. **Role checks are server-side.** Client-supplied role claims are ignored. Authorization is derived from membership + subscription state on every request.
5. **Workout data persists** and is queryable for progress charts, certificates, and trainer tables.
6. **No-show auto-reschedule.** PT booking missed at `start_at + grace_minutes` is moved to the next calendar day, same local time, calendar updated, both parties notified.
7. **Certificates and share cards** are generated server-side as images (PNG/WebP) so social posts are consistent.

### 1.3 Success criteria

| Metric | Target |
|---|---|
| Time from login to first workout action (GT) | ≤ 3 taps: calendar → session → first set |
| Complete Set local ack | ≤ 100 ms; queued if offline |
| Plan revision visible to online client | ≤ 2 s with revision badge |
| 3D landing LCP (desktop, reduced-motion off) | ≤ 2.5 s; 3D is progressive |
| Frame budget for 3D hero | ≥ 45 fps on mid-tier laptops; pause when tab hidden |
| WCAG | 2.2 AA; `prefers-reduced-motion` disables 3D/particle loops |
| Layout | Desktop (1280+) and tablet (768–1279); phone is later, not blocking v1 |

---

## 2. System architecture

### 2.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Web | Next.js (App Router) + TypeScript | SSR/RSC for auth shells, role layouts, SEO on marketing |
| 3D | React Three Fiber + drei + Three.js | Landing kinetic scene; code-split, not loaded in dashboards |
| Motion | Framer Motion + CSS WAAPI | Page transitions, micro-interactions; honor reduced motion |
| Charts | Recharts or Visx | Progress, body composition, admin revenue |
| API | NestJS modular monolith (or Next.js Route Handlers + domain services for v1) | Coherent auth/transactions before microservices |
| DB | PostgreSQL 16, UUID PKs, RLS | Multi-tenant source of truth |
| ORM | Prisma or Drizzle + SQL migrations | Typed models, reviewable migrations |
| Cache / jobs | Redis + BullMQ | Presence, rate limits, reminders, certificate jobs, no-show scan |
| Realtime | WebSockets (Socket.IO or Nest gateway) + Redis adapter | Live workout presence, trainer inbox |
| Media | S3-compatible private buckets + CloudFront | Demo videos, progress photos, certificates |
| Payments | Stripe Billing (subscriptions + customer portal + webhooks) | Trainer-only billing |
| Auth | Custom sessions: Argon2id passwords, rotating refresh cookies, optional TOTP | Role entry points without trusting JWT role fields |
| Push | Web Push (VAPID) + email (Resend/SES) | Reminders, no-shows, messages |
| Observability | OpenTelemetry, structured logs, Sentry | Health data redacted from analytics |
| Hosting | Containers (API) + Vercel/Fly/AWS for web | Blue/green API, edge for marketing |

**Do not load Three.js on authenticated dashboards.** The 3D bundle is a landing-only dynamic import.

### 2.2 Logical diagram

```
[Browser]
  Landing (R3F scene, code-split)
  Role shells: /app/gt | /app/pt | /app/trainer | /app/admin
        |
        v
[Next.js BFF]
  Session cookie, CSRF, signed media URLs, RSC data loaders
        |
        v
[API domain modules]
  Identity | Tenants+Billing | Programs | Workout runtime
  Bookings | Messaging | Certificates | Analytics | Admin
        |
        +--> PostgreSQL (RLS)
        +--> Redis (cache, presence, queues)
        +--> Object storage
        +--> Stripe webhooks (signature verified)
        +--> WebSocket gateway
```

### 2.3 Multi-trainer tenancy

- Each **trainer business** is a `tenants` row (`slug`, branding, timezone).
- Trainer users have `tenant_memberships.membership_role = owner | coach`.
- Clients belong to exactly one active trainer relationship per tenant.
- Platform admins have **no** tenant membership; they use a `platform_admins` grant.
- Data access: `WHERE tenant_id = :ctx.tenant_id` plus relationship checks. RLS mirrors this.

Isolation: Trainer A cannot read Trainer B’s clients, plans, videos, or revenue. Admin analytics are aggregates unless an explicit support-impersonation flow is started (audited, time-boxed, MFA).

### 2.4 Module boundaries

1. **Identity** — login by intended role, sessions, recovery, MFA  
2. **Tenancy & billing** — tenants, Stripe customer, subscription, feature flags by tier  
3. **Directory** — users, invitations, suspend/delete  
4. **Catalog** — exercises, demo videos, muscle tags  
5. **Programming** — GT daily plans, PT cardio/strength templates, versioning  
6. **Workout runtime** — sessions, set rows, complete-set invariant  
7. **Bookings** — PT slots, attendance, auto-reschedule  
8. **Progress** — metrics, photos, charts  
9. **Gamification** — streaks, badges, GT leaderboards (tenant-scoped)  
10. **Certificates & share** — render jobs, OG images  
11. **Messaging & notifications** — trainer→client, system events  
12. **Admin ops** — users, subscriptions, tiers, revenue, audit  

---

## 3. Authentication and session flow

### 3.1 Entry

Marketing `/` is public. Primary CTA opens `/enter`. Role is **not** chosen as a security control; it is a UX router:

1. User submits email + password (or magic link).  
2. Server authenticates credentials.  
3. Server loads `user_roles`, `tenant_memberships`, trainer `subscriptions.status`.  
4. Server issues session bound to `user_id` + `active_role` + `tenant_id` (null for platform admin).  
5. Redirect:
   - `platform_admin` → `/admin`
   - `trainer` with `subscription in (active, trialing)` → `/trainer`
   - `trainer` otherwise → `/billing/blocked` (read-only lapse page: paywall only)
   - `gt_client` → `/gt`
   - `pt_client` → `/pt`
   - Multiple roles → `/choose-context` then lock `active_role` for the session

Login pages may be branded (`/login/trainer`, `/login/client`, `/login/admin`) but they call the **same** identity service. Each entry point **restricts** which roles may complete login there (admin cannot finish on `/login/client`).

### 3.2 Token model

| Item | Web | Notes |
|---|---|---|
| Access session | HttpOnly, Secure, SameSite=Lax, 15 min sliding | Opaque session id, not a JWT role bag |
| Refresh | HttpOnly, rotating, 14–30 days | Stored hashed in `sessions` |
| CSRF | Double-submit or SameSite + origin check | Required for cookie mutations |
| Trainer gate | Middleware + API guard | `requireTrainerSubscription()` |

Password: Argon2id. Reset: single-use email token 30 min. Admin can trigger recovery without seeing the new password. Breached-password check (HaveIBeenPwned k-anonymity) on set/reset.

MFA: TOTP required for `platform_admin` and trainer **owners**. Optional for coaches and clients.

### 3.3 Authorization pipeline (every request)

```
authenticate session
  → load user, roles, memberships, subscription
  → reject if status != active (suspended/deleted)
  → if trainer surface: require subscription active|trialing else 402
  → bind AuthContext { userId, tenantId, role, permissions[] }
  → policy: resource + action
  → repository query includes tenant_id + relationship predicates
  → redact PHI in admin responses
  → audit mutations
```

Never authorize from UI routes alone. RSC layouts check the same guards.

### 3.4 Account recovery (admin)

Admins can: unlock lockouts, invalidate all sessions, send reset email, disable MFA (with audit), unsuspend. They cannot set a known password. Impersonation: separate `impersonation_sessions` with 15-minute TTL, watermark in UI, full audit.

---

## 4. Subscription and payments

### 4.1 Who pays

Only **trainers** (tenant owners). Clients are seats included in the trainer plan (hard cap by tier).

### 4.2 Tiers (v1)

| Tier | Seats (GT+PT) | Coaches | Features |
|---|---|---|---|
| Studio | 25 clients | 1 owner | GT+PT programming, bookings, certificates, basic analytics |
| Atelier | 100 clients | 3 coaches | Leaderboards, advanced charts, custom branding, video library 50 GB |
| Maison | 500 clients | 10 coaches | API export, white-label domain, priority support, 500 GB media |

Feature flags live in `subscription_tiers.entitlements_json`. Enforcement is server-side (`entitlements.leaderboards`, etc.).

### 4.3 Stripe objects

- `tenants.stripe_customer_id`
- `subscriptions` row synced from Stripe Subscription
- Checkout Session for new subscribe
- Customer Portal for card update / cancel
- Webhooks: `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`

### 4.4 Immediate revoke

On `past_due` (after retry policy) or `canceled` / `unpaid`:

1. Webhook updates `subscriptions.status`.  
2. Redis key `tenant:{id}:access` = `revoked`.  
3. All trainer API routes return **402 Payment Required** with `{ code: "SUBSCRIPTION_INACTIVE" }`.  
4. WebSocket disconnects trainer sockets.  
5. Client apps remain readable for **already assigned** workouts for 7 days (grace for clients, not trainers) — configurable. Trainer **cannot** edit plans, message, or view live board.  
6. Email trainer: access revoked + portal link.

Trial: 14 days, still `trialing` = allowed. No access without a Stripe customer after trial if payment method missing.

**There is no bypass, coupon-only access, or manual “honor system” flag** except a time-boxed `billing_overrides` row created by platform admin (reason required, max 7 days, audited).

---

## 5. Database schema

Conventions: `id uuid PK`, `created_at`, `updated_at` timestamptz. Soft delete via `deleted_at` only on users and media. FKs `ON DELETE RESTRICT` unless noted. `tenant_id` on every tenant-owned table. Enable RLS.

### 5.1 Identity and tenancy

```sql
users (
  id, email citext unique, phone, password_hash, status, -- active|suspended|deleted
  last_login_at, locale, timezone
)

user_roles (
  user_id, role, -- platform_admin|trainer|gt_client|pt_client
  unique(user_id, role)
)

tenants (
  id, name, slug unique, status, timezone, branding_json,
  stripe_customer_id, owner_user_id
)

tenant_memberships (
  tenant_id, user_id, membership_role, -- owner|coach|client
  status, joined_at, unique(tenant_id, user_id)
)

trainer_client (
  tenant_id, trainer_user_id, client_user_id,
  program_type, -- gt|pt
  status, started_at, ended_at
  -- unique active (tenant_id, client_user_id)
)

sessions (
  id, user_id, tenant_id, active_role, refresh_token_hash,
  device_name, expires_at, revoked_at, ip_hash
)

mfa_methods (user_id, type, secret_ciphertext, verified_at)

audit_events (
  tenant_id, actor_user_id, action, entity_type, entity_id,
  metadata_json, ip_hash  -- append-only
)
```

### 5.2 Billing

```sql
subscription_tiers (
  id, code unique, name, seat_limit, coach_limit, entitlements_json, stripe_price_id
)

subscriptions (
  id, tenant_id unique, tier_id, stripe_subscription_id unique,
  status, -- trialing|active|past_due|canceled|unpaid|incomplete
  current_period_end, cancel_at_period_end
)

billing_overrides (
  tenant_id, reason, granted_by, starts_at, ends_at, revoked_at
)

invoices (
  id, tenant_id, stripe_invoice_id, amount_cents, currency, status, paid_at
)
```

### 5.3 Profile and progress

```sql
client_profiles (
  tenant_id, user_id,
  height_cm, current_weight_kg, body_fat_pct,
  sex, goal, onboarding_completed_at
)

body_metrics (
  tenant_id, client_user_id, recorded_at,
  weight_kg, height_cm, body_fat_pct, notes
  -- BMI generated: weight_kg / (height_m^2); store generated_bmi for history
)

progress_images (
  tenant_id, client_user_id, storage_key, kind, -- before|after|progress
  captured_at, moderation_status, width, height
)
```

BMI is derived, labeled as calculated, never as diagnosis.

### 5.4 Exercise catalog and programming

```sql
exercises (
  tenant_id null, -- null = platform catalog
  name, slug, primary_muscle, secondary_muscles[],
  equipment, demo_video_key, demo_poster_key, cues_md
)

muscle_groups (id, code, display_name) -- chest, back, ...

gt_plans (
  tenant_id, trainer_user_id, training_date date,
  status, revision, published_at
  unique(tenant_id, training_date, revision) -- one published revision per date
)

gt_plan_groups (
  gt_plan_id, muscle_group_id, sort_order
  -- CHECK: exactly 5 child variations
)

gt_plan_exercises (
  gt_plan_group_id, exercise_id, variation_index smallint check (1..5),
  prescribed_sets, notes, unique(gt_plan_group_id, variation_index)
)

pt_programs (
  tenant_id, client_user_id, kind, -- cardio|strength
  trainer_locked boolean, -- false => client-editable fields allowed
  revision, published_at
)

pt_program_exercises (
  pt_program_id, exercise_id, sort_order,
  prescribed_sets, prescribed_reps, prescribed_weight, rest_seconds, notes
)
```

DB trigger or application transaction: each `gt_plan_groups` must have **exactly 5** `gt_plan_exercises` before `gt_plans.status = published`.

### 5.5 Workout runtime (integrity)

```sql
workout_sessions (
  tenant_id, client_user_id, program_type,
  session_date, source_plan_id, source_revision,
  status, -- in_progress|completed|abandoned
  started_at, completed_at, certificate_id
)

workout_set_logs (
  session_id, exercise_id, variation_index,
  set_number, -- 1..N
  reps, weight_kg, rest_seconds, notes,
  completed_at timestamptz, -- NULL = invalid / not counted
  client_edited boolean
)
```

**Invariant:** Aggregations use `WHERE completed_at IS NOT NULL`. Completing a set is `PATCH` that stamps `completed_at = now()`. Editing a completed set requires a new set row or explicit `reopen` (trainer policy: clients cannot silently mutate completed sets without a new complete action).

### 5.6 Bookings and no-shows

```sql
trainer_availability (
  tenant_id, trainer_user_id, weekday, start_local, end_local
)

bookings (
  tenant_id, trainer_user_id, client_user_id,
  start_at timestamptz, end_at timestamptz,
  status, -- booked|checked_in|completed|no_show|rescheduled|canceled
  check_in_at, rescheduled_from_id, grace_minutes default 15
)

no_show_events (
  booking_id, detected_at, next_booking_id, notify_job_id
)
```

Job every minute: bookings where `now() > start_at + grace` and `status = booked` and `check_in_at is null` → `no_show`, clone booking `start_at + 1 day` (skip trainer blackout; if slot taken, next free slot same day then following days up to 7), notify both.

### 5.7 Gamification, messaging, certificates

```sql
streaks (tenant_id, client_user_id, current_count, longest, last_completed_date)
badges (id, code, name, rule_json)
client_badges (client_user_id, badge_id, earned_at, tenant_id)
leaderboard_snapshots (tenant_id, period, payload_json, computed_at) -- GT only

messages (
  tenant_id, from_user_id, to_user_id, body, read_at
)

notifications (
  user_id, type, payload_json, channel, -- push|email|in_app
  sent_at, read_at
)

push_subscriptions (user_id, endpoint, p256dh, auth)

certificates (
  tenant_id, session_id, storage_key, share_token unique,
  metrics_json, generated_at
)
```

### 5.8 Indexes (minimum)

- `(tenant_id, training_date)` on gt_plans  
- `(session_id, exercise_id, set_number)` unique on workout_set_logs  
- `(tenant_id, client_user_id, recorded_at desc)` on body_metrics  
- `(trainer_user_id, start_at)` on bookings  
- `(tenant_id, status)` on trainer_client  
- Partial unique active trainer_client per client  

---

## 6. API specification

Base: `https://api.elevate.example/v1`  
Auth: session cookie. Errors: `{ error: { code, message } }`  
Idempotency-Key on POSTs that create bookings, sessions, certificates.

### 6.1 Auth

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | Rate limit 10/min/IP; sets cookies |
| POST | `/auth/logout` | authed | Revoke session |
| POST | `/auth/refresh` | refresh cookie | Rotate |
| POST | `/auth/forgot` | public | Always 202 |
| POST | `/auth/reset` | token | |
| POST | `/auth/mfa/verify` | pending MFA | |
| GET | `/auth/me` | authed | user, role, tenant, entitlements, subscription |

### 6.2 Trainer billing

| Method | Path | Access |
|---|---|---|
| POST | `/billing/checkout` | trainer owner |
| GET | `/billing/portal` | trainer owner |
| GET | `/billing/status` | trainer |
| POST | `/webhooks/stripe` | Stripe sig |

### 6.3 GT client

| Method | Path | Rules |
|---|---|---|
| GET | `/gt/calendar?from&to` | days with published plans |
| GET | `/gt/plans/:date` | 5 variations per group + demo URLs |
| POST | `/gt/sessions` | create/open session for date |
| PUT | `/gt/sessions/:id/sets/:setId` | draft reps/weight/rest/notes |
| POST | `/gt/sessions/:id/sets/:setId/complete` | **required**; stamps `completed_at` |
| POST | `/gt/sessions/:id/complete` | all prescribed sets completed_at not null |
| GET | `/gt/sessions/:id/certificate` | 409 if session incomplete |
| POST | `/gt/sessions/:id/share` | returns signed image + intent URLs |
| GET | `/gt/leaderboard?period=week` | if entitlement |

### 6.4 PT client

| Method | Path | Rules |
|---|---|---|
| GET | `/pt/dashboard` | cardio + strength summaries |
| GET | `/pt/programs/:kind` | cardio \| strength |
| PATCH | `/pt/programs/:kind` | only unlocked fields |
| GET/POST | `/pt/sessions` | same set protocol as GT |
| POST | `/pt/sessions/:id/sets/:setId/complete` | same invariant |
| GET/PATCH | `/pt/profile` | BMI computed server-side |
| POST | `/pt/profile/images` | before/after; MIME allowlist |
| GET | `/pt/progress?metric&from&to` | series for charts |
| GET | `/pt/availability` | assigned trainer |
| POST | `/pt/bookings` | conflict 409 |
| GET | `/pt/bookings` | includes auto-reschedules |

### 6.5 Trainer

| Method | Path | Notes |
|---|---|---|
| GET | `/trainer/clients` | table fields below |
| GET | `/trainer/clients/:id` | profile, metrics, images, no-shows |
| GET | `/trainer/live` | websocket snapshot: active / completed today |
| PUT | `/trainer/gt/plans/:date` | validate 5 variations |
| PUT | `/trainer/pt/clients/:id/programs/:kind` | |
| POST | `/trainer/messages` | to one client |
| GET | `/trainer/no-shows` | PT only |
| POST | `/trainer/bookings/:id/check-in` | optional gym kiosk later |

`GET /trainer/clients` columns: `name, program_type, last_workout_at, today_status, weight_kg, bmi, body_fat_pct`.

### 6.6 Admin

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/admin/users` | create |
| PATCH | `/admin/users/:id` | edit, suspend, roles |
| DELETE | `/admin/users/:id` | GDPR path: anonymize + delete media |
| POST | `/admin/users/:id/recovery` | lockout clear + reset email |
| GET | `/admin/tenants` | subscription, seats |
| POST | `/admin/tenants/:id/billing-override` | max 7 days |
| GET | `/admin/analytics/overview` | users by role, sub status, revenue |
| GET/PUT | `/admin/tiers` | feature flags |
| GET | `/admin/audit` | filter by actor/entity |

### 6.7 Realtime events

| Event | Payload | Recipients |
|---|---|---|
| `session.started` | clientId, sessionId | trainer live board |
| `set.completed` | sessionId, setId | trainer |
| `session.completed` | clientId | trainer |
| `booking.rescheduled` | old, new | trainer + client |
| `message.created` | threadId | counterpart |
| `subscription.revoked` | tenantId | all trainer sockets |

---

## 7. Domain workflows

### 7.1 Group training client

```
Login → /gt
  Calendar (published dates only)
  Select date → Plan view grouped by muscle
    Each group: exactly 5 exercise cards
      Card: name, muscles, demo (video + muscle diagram)
      5 columns: Set # | Reps | Weight | Rest | Notes
      Per set row: [Complete Set] — disabled until reps+weight valid
      Incomplete rows: visual “not counted”
  After last valid set of last exercise: [Finish workout]
  Server validates all required sets completed_at
  Certificate job → PDF/PNG
  Share sheet: Instagram (image download + copy), Facebook/Twitter intent + OG URL /share/c/:token
  Streak + badges updated
```

Demo video: HLS or MP4 via signed URL, captions, muscle highlight list. Pause offscreen.

### 7.2 Personal training client

```
Login → /pt
  Two modules: Cardio | Strength (trainer preloaded, client-editable if unlocked)
  Same set grid + Complete Set
  Profile: height, weight, BMI (read-only computed), body fat, before/after gallery
  Book slot → calendar
  Progress: weight/BMI/body-fat over time + workout volume
```

No-show:

```
start_at + grace → still booked, no check-in
  booking.status = no_show
  create booking D+1 (or next open)
  calendars updated
  notify trainer + client (push + email + in-app)
```

### 7.3 Trainer

```
/trainer
  Live strip: active now / completed today / not started / PT no-shows
  Table of clients (sortable, filter GT|PT)
  Row → profile: metrics sparkline, photos, messages, plan editor
  GT: calendar editor, 5-variation enforcer in UI + API
  PT: cardio/strength builder, lock/unlock client edits
  No-show log
```

### 7.4 Admin

```
/admin
  Users CRUD + suspend + recovery
  Tenants + Stripe status (badge: active/past_due/revoked)
  Revenue and role mix
  Tier editor
  Audit log
```

---

## 8. UI/UX specification

### 8.1 Design language

| Token | Direction |
|---|---|
| Color | Near-black `#0B0C0E`, warm stone `#E8E2D6`, single metal accent (champagne `#C4A574`) — not rainbow fitness neon |
| Type | Display: editorial serif for marketing only; Product: Inter/Satoshi for UI; tabular nums for weights |
| Radius | 12–16px cards; hairline borders `rgba(255,255,255,0.08)` |
| Motion | 180–280 ms entrance; 120 ms button; spring only on share/certificate |
| Density | Trainer/admin tables denser; client workout UI large tap targets (≥44 px) |

Tablet: split view where useful (calendar | plan). Sticky Complete Set on the active set. No horizontal dump of five columns on narrow tablet — stack labels above inputs, keep five fields.

### 8.2 Landing (3D)

**Concept A — Kinetic iron**  
Dark infinite studio. A slowly orbiting chrome barbell and plates; particles follow lift path. Camera dolly on scroll. Copy overlays: wordmark, one sentence, Enter.

**Concept B — Anatomical light**  
Stylized figure (non-gore, abstract) with muscle groups blooming as the camera passes; click muscle → login with that energy. Better metaphor for GT muscle groups.

**Concept C — Architectural gym**  
Brutalist interior, volumetric light, treadmill belts as infinite shaders. Most “luxury real-estate.” Heavier GPU.

**v1 recommendation:** Concept A (smallest asset budget, readable luxury) with a static poster + CSS fallback for reduced motion and WebGL fail.

Animation spec:

| Beat | Time | Action |
|---|---|---|
| 0.0 | load | Poster visible; WASM/GL init behind |
| 0.4 | fade | Canvas opacity 0→1 if fps ok |
| idle | loop | Barbell Y 4° oscillation, 8s; dust 2k particles max |
| scroll 0–40% | camera | z 8 → 4.5, FOV 45→38 |
| hover CTA | 120 ms | metal roughness 0.35→0.2 |
| hidden tab | — | `invalidate()` stop; no RAF |

Performance: `dpr` cap 1.5, no shadows on tablet, instanced plates, `Suspense` + `useGLTF` Draco. If `fps < 30` for 2s, swap to still + subtle CSS ken burns.

Page transitions: shared-element dark veil 200 ms into `/enter`. Dashboards: no 3D.

### 8.3 Wireframes (information architecture)

**GT home**  
Header: wordmark, streak pill, profile. Body: month calendar (published days marked). Footer nav: Plan, Progress, Leaderboard, Profile.

**GT workout**  
Left (tablet+): exercise list with completion ticks. Right: active exercise, looping demo (muted), muscle chips, set table, sticky Complete Set. Certificate modal on finish.

**PT home**  
Two large tiles: Cardio / Strength with last session + sparkline. Row: Book / Profile / Progress.

**PT book**  
Week grid of trainer slots; selected slot confirm; upcoming list with reschedule banners.

**Trainer**  
Top stats: Active now, Completed, At risk (no-show 7d). Main: client table. Drawer: message composer. Secondary nav: GT calendar, PT programs, Live.

**Admin**  
Left nav: Users, Tenants, Billing, Tiers, Analytics, Audit. Main: filters + table. Analytics: users by role, subscription mix, MRR, failed payments.

Micro-interactions: Complete Set → 80 ms scale + check; haptics N/A on web, use brief color flash (stone → champagne). Invalid complete: shake 120 ms + inline error “Log reps and weight first.”

### 8.4 Certificate

Portrait 1080×1920 share card:

- Tenant wordmark  
- Client name, date, program type  
- Volume: sets completed (valid only), total kg, duration  
- QR / URL to `/share/c/:token` (public, no PHI beyond first name + aggregates)  
- Optional muscle map silhouette  

Generation: Playwright/Satori on worker, stored privately, public share token maps to a **redacted** PNG.

Social:

- Twitter/X: `intent/tweet?url=&text=`  
- Facebook: sharer.php + OG tags on share URL  
- Instagram: download image + “Open Instagram” hint (no official web post API)

---

## 9. Notifications

| Event | Push | Email | In-app |
|---|---|---|---|
| Workout reminder (T-2h, trainer tz) | yes | optional | yes |
| Trainer message | yes | no body PHI | yes |
| No-show reschedule | yes | yes | yes |
| Plan published / revised | yes | no | yes |
| Subscription past_due / revoked | trainer | yes | paywall |
| Certificate ready | yes | no | yes |

Push payload: title + generic body; **no weights or photos**. Deep link into the app route.

---

## 10. Security, privacy, compliance

- TLS everywhere; encryption at rest; KMS for backups  
- Signed URLs 5 minutes; strip EXIF GPS  
- Allowlist `image/jpeg|png|webp`, `video/mp4`; scan malware; size caps  
- Admin analytics: counts and money, not body images  
- Export/delete for clients (GDPR)  
- Rate limits on login, complete-set (anti-spam, not anti-workout: burst 30/min)  
- RLS + policy tests in CI  
- Stripe webhook signature required  
- Legal: fitness disclaimer; videos licensed by tenant; supplements out of scope  

---

## 11. Implementation roadmap

### Phase 0 — Foundation (2 weeks)

Monorepo, Next.js, Nest/API, Postgres, Prisma, auth cookies, tenant + role middleware, design tokens, CI.

### Phase 1 — Identity & tenancy (2 weeks)

Login routers, invitations, trainer tenant bootstrap, admin user CRUD, audit log.

### Phase 2 — Billing (1.5 weeks)

Stripe checkout, portal, webhooks, 402 gate, lapse UX. **No trainer UI beyond billing until this is green.**

### Phase 3 — Catalog & GT (3 weeks)

Exercises + demo upload, GT planner with 5-variation constraint, client calendar, set logs, Complete Set, session complete.

### Phase 4 — Certificates, share, gamification (1.5 weeks)

Render worker, share pages, streaks, badges, GT leaderboard.

### Phase 5 — PT (3 weeks)

Cardio/strength programs, profile/metrics/photos, charts, bookings, no-show worker.

### Phase 6 — Trainer live & messaging (2 weeks)

Client table, live websocket, messages, no-show views, progress timeline.

### Phase 7 — Landing 3D & motion (1.5 weeks)

R3F scene A, fallbacks, transitions; Lighthouse + GPU budget.

### Phase 8 — Admin analytics & hardener (2 weeks)

Analytics, tiers, recovery, load tests, RLS pentest, tablet QA.

### Phase 9 — Pilot (2 weeks)

2–3 trainers, production Stripe, support runbook, iterate.

**Critical path:** Auth → Billing gate → GT runtime invariant → PT bookings → Trainer board → 3D polish (3D is not on the data-integrity path).

---

## 12. Testing strategy

- Unit: BMI, 5-variation validator, no-show next-slot picker  
- Integration: complete-set cannot be skipped; session complete 409 otherwise  
- Contract: Stripe webhook fixtures  
- E2E: Playwright GT happy path + PT no-show clock mock  
- RLS: attempt cross-tenant reads must fail  
- Visual: Chromatic for dashboard; 3D excluded or screenshot poster only  

---

## 13. Out of scope for v1

Native iOS/Android apps, Apple Health/Google Fit, in-person kiosk check-in hardware, client-paid marketplace, AI form critique, public social feed, phone-first layout (tablet/desktop only).

---

## 14. Open decisions (defaults)

| Topic | Default |
|---|---|
| API host | Modular NestJS alongside Next.js; extract later |
| Weight units | Store kg; display kg/lb from profile |
| Rest input | Store seconds; UI allows mm:ss |
| Check-in | Client “I’m here” button + trainer mark; GPS later |
| Leaderboard | Opt-in per client, tenant-scoped GT only |
| Video | Tenant-uploaded; platform starter library licensed separately |
