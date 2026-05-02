# GharSetu — Engineering Specification

A localised PG and room rental service for university students, server-rendered for slow networks, federated to the broader retail commerce layer through a Beckn-compliant Buyer/Seller App surface, and deployable as a single Cloud Run revision with no idle cost.

| Field         | Value                                                |
|---------------|------------------------------------------------------|
| Version       | 0.1.0                                                |
| Status        | Draft — MLP candidate, pre-launch                    |
| Last reviewed | 2026-05-02                                           |
| Owner         | Akshit Thakur (`contact@dmj.one`)                    |
| Repository    | `/home/dmj/akshit-thakur-capstone/`                  |

---

## 1. Scope and non-goals

### 1.1 In scope

This document is the canonical engineering contract for the GharSetu MLP service. It covers:

- The HTTP surface served by `dist/server.js` (HTML pages, JSON APIs, ONDC Beckn endpoints, health endpoints, the service worker).
- The persistent data model in SQLite (10 tables defined in `src/db/schema.sql`).
- The runtime configuration surface (`src/config.ts`).
- Authentication, authorisation, session handling, CSRF.
- The simulated DigiLocker, Razorpay and ONDC integration surfaces.
- The build pipeline (`python3 scripts/render_pages.py` then `tsc` then asset copy) and the multi-stage container.
- The Cloud Run deployment topology including secret bindings.
- Observability (structured logging, audit log, SIEM-style admin view).
- Accessibility, internationalisation, and performance budgets.

### 1.2 Out of scope

The following are explicitly NOT covered by this specification:

- Native mobile applications (Android/iOS) — the PWA surface is the only client.
- A back-office payment reconciliation system distinct from the platform.
- A separate marketing or landing-page site — `/` and `/about` ship inside the app.
- The persistent data tier beyond SQLite-on-`/tmp` (Cloud SQL migration is referenced in section 18 but is not in this version of the contract).
- Any direct integration with banks, government registries, or third-party brokers beyond the simulated facades.

### 1.3 Conformance

- The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY** are used per RFC 2119.
- Where this document and the code disagree, the code **MUST** be changed to match this document. This document is the source of truth.

---

## 2. Glossary

| Term                | Definition                                                                                                                                  |
|---------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| BAP                 | Beckn Application Platform — buyer-side app that initiates `search/select/init/confirm` actions in a Beckn transaction.                     |
| BPP                 | Beckn Provider Platform — seller-side app that responds asynchronously with `on_search/on_select/on_init/on_confirm`. GharSetu acts as BPP. |
| Beckn protocol      | An open peer-to-peer protocol that decouples buyer-side discovery from seller-side fulfillment using a `{context, message}` envelope.       |
| ONDC                | Open Network for Digital Commerce — the Government of India network that operates a Beckn registry, gateway, and reference policies.        |
| DigiLocker          | A Government of India identity wallet that issues OAuth 2.0 tokens for verified Aadhaar-linked credentials.                                 |
| KYC                 | Know-Your-Customer — the user-identity verification flow. In GharSetu, satisfied via DigiLocker (currently simulated).                      |
| MLP                 | Minimum Lovable Product — feature-complete enough to honestly defend in user trials, beyond the floor of an MVP.                            |
| PWA                 | Progressive Web App — installable web app with a service worker; here used for offline shell and last-N listings cache.                     |
| SIEM                | Security Information and Event Management — the admin audit feed at `/admin` is presented in a SIEM-style live table.                       |
| SSE                 | Server-Sent Events — used by `/admin/audit/stream` to push new audit rows every two seconds.                                                |
| RTL                 | Right-to-left writing direction; CSS uses logical properties (`margin-inline-start`) so that adding Urdu/Arabic does not require re-layout. |
| WCAG 2.2 AAA        | Web Content Accessibility Guidelines version 2.2, Triple-A conformance level (highest).                                                     |
| Verified renter     | A feedback author for whom an active `renter_records` row exists for the listing under review (see section 10).                             |
| Outsider review     | Feedback whose author has no active `renter_records` row for the listing — surfaced with a distinct badge.                                  |
| Ephemeral storage   | The Cloud Run `/tmp` filesystem; per-instance, lost on revision rollover, scale-to-zero, or restart.                                        |

---

## 3. System overview

GharSetu is a single Node.js process. Fastify serves both HTML (EJS) and JSON. SQLite is opened on `/tmp/gharsetu.db` at boot and seeded if empty. All request flow is synchronous in-process apart from outbound ONDC `on_<action>` callbacks, which are dispatched on the next event-loop tick after returning a Beckn ACK.

```
                            ┌──────────────────────────────────┐
                            │       Cloud Run (asia-south1)    │
                            │                                  │
   PWA / browser ─────────► │  Fastify (Node 22, TS strict)    │
   (HTML, JS, CSS,          │   ├─ EJS views     (server-side) │
    service worker)         │   ├─ Routes        (src/routes)  │
                            │   ├─ Auth          (JWT cookie)  │
                            │   ├─ CSRF          (double-cookie)│
                            │   ├─ Pino logger   (structured)  │
                            │   └─ better-sqlite3 (synchronous)│
   Beckn BAP    ──────────► │      ↑               │           │
   (ONDC peer)              │      │   /tmp ── ephemeral edge ─│──► gharsetu.db (WAL)
                            │      │                           │     /uploads/*.webp
   Razorpay     ──────────► │      │  /pay/webhook (HMAC-256)  │
   sandbox sim              │      │                           │
                            │      │  /verify/digilocker/*     │
   DigiLocker   ──────────► │      │  (simulated OAuth 2.0)    │
   simulated                │      │                           │
                            │  Secret Manager bindings:        │
                            │   JWT, RZP, DigiLocker, admin pw │
                            └──────────────────────────────────┘

  Trust boundary: every external network ingress crosses the rate-limited
  Fastify edge; every PII touch passes through `audit()` which writes to
  audit_log with the redactor list applied (see logger.ts).
```

The simulated surfaces (DigiLocker, Razorpay, ONDC) are local handlers that mimic the production wire format. Each carries a top-of-file `===== REAL PROD CODE (replace stub on launch) =====` block describing the production replacement.

---

## 4. Stack and dependencies

### 4.1 Runtime stack

| Layer            | Implementation         | Version      | Why                                                                                  |
|------------------|------------------------|--------------|--------------------------------------------------------------------------------------|
| Runtime          | Node.js                | 22 LTS       | Native `fetch`, stable test runner, long support window.                             |
| Language         | TypeScript             | ^5.7.3       | Strict mode (no `any`, `noUncheckedIndexedAccess`); compiled with `tsc`.             |
| HTTP framework   | Fastify                | ^5.2.1       | Schema-first, fast JSON, plugin model matches our middleware order.                  |
| View engine      | EJS                    | ^3.1.10      | Server-rendered output, no client framework, minimal hydration.                      |
| Database         | better-sqlite3         | ^11.7.0      | Synchronous in-process API; embeddable; WAL mode survives interleaved reads/writes.  |
| Image processing | sharp                  | ^0.34.1      | WebP encode and resize at upload; binds to libvips.                                  |
| Auth             | jsonwebtoken           | ^9.0.2       | HS256 stateless tokens, validated against the `sessions` revocation table.           |
| Password hashing | bcryptjs               | ^3.0.2       | Cost-12 hashing; pure-JS so portable in slim images.                                 |
| Validation       | zod                    | ^3.24.1      | Runtime schema validation at every input boundary.                                   |
| ID generation    | ulid                   | ^2.3.0       | Lexicographically sortable, monotonic, URL-safe.                                     |
| Logging          | pino                   | ^9.5.0       | Structured JSON logs; redactor for PII paths.                                        |
| Cookie           | @fastify/cookie        | ^11.0.2      | Signed cookies under a single `COOKIE_SECRET`.                                       |
| CSRF             | @fastify/csrf-protection| ^7.1.0      | Double-submit cookie for all state-changing form posts.                              |
| Form parsing     | @fastify/formbody      | ^8.0.2       | URL-encoded POST bodies.                                                             |
| Multipart        | @fastify/multipart     | ^9.0.3       | Image upload streams, capped at 6 files of 8 MiB each.                               |
| Static           | @fastify/static        | ^8.1.1       | Serves both `/static/*` (build assets) and `/uploads/*` (image edge).                |
| Rate limit       | @fastify/rate-limit    | ^10.2.2      | Per-IP token bucket; `/healthz` and `/readyz` allow-listed.                          |
| Templating glue  | @fastify/view          | ^11.0.0      | Bridges EJS into the Fastify reply API.                                              |

### 4.2 Build-time Python dependencies

The build step renders the capstone artefacts (`.docx` report, `.pptx` deck) into HTML fragments that the runtime serves at `/report` and `/pitch`. The Dockerfile installs Python only in the builder stage; the runtime image carries no Python interpreter.

| Package      | Version  | Purpose                                                         |
|--------------|----------|-----------------------------------------------------------------|
| python-docx  | 1.1.0    | Parse `Akshit_Thakur_Capstone_Report.docx`; emit semantic HTML. |
| python-pptx  | 1.0.2    | Parse `Akshit_Thakur_Capstone_Presentation.pptx`; emit a slide deck with absolute-positioned shapes. |
| Pillow       | latest   | Image fallback for python-pptx shape rasterisation.             |

### 4.3 Dev dependencies

| Package                    | Version  | Purpose                                                  |
|----------------------------|----------|----------------------------------------------------------|
| tsx                        | ^4.19.2  | TypeScript watch runner for `npm run dev` and tests.     |
| @types/node                | ^22.10.5 | Node 22 ambient typings.                                 |
| @types/bcryptjs            | ^2.4.6   | Type declarations.                                       |
| @types/better-sqlite3      | ^7.6.12  | Type declarations.                                       |
| @types/ejs                 | ^3.1.5   | Type declarations.                                       |
| @types/jsonwebtoken        | ^9.0.7   | Type declarations.                                       |

---

## 5. Configuration

All variables are consumed in `src/config.ts`. Variables marked **Required for prod** **MUST** be supplied via Secret Manager (see section 16). The remainder **MAY** be supplied as plain Cloud Run env vars.

| Env var                       | Default                                                                | Purpose                                                                                                | Required for prod |
|-------------------------------|------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|-------------------|
| `NODE_ENV`                    | `production`                                                           | Selects production-mode optimisations and cookie security defaults.                                    | No (set by infra) |
| `PORT`                        | `8080`                                                                 | TCP port the server binds to.                                                                          | No                |
| `HOST`                        | `0.0.0.0`                                                              | Bind address.                                                                                          | No                |
| `LOG_LEVEL`                   | `info` (prod), `debug` (dev)                                           | Pino log level.                                                                                        | No                |
| `DB_PATH`                     | `/tmp/gharsetu.db`                                                     | SQLite database path. Ephemeral on Cloud Run.                                                          | No                |
| `UPLOADS_DIR`                 | `/tmp/uploads`                                                         | Directory for resized WebP images. Ephemeral on Cloud Run.                                             | No                |
| `SEED_ON_START`               | `1`                                                                    | If truthy and `users` is empty, seed demo users plus Shoolini-area listings.                           | No                |
| `JWT_SECRET`                  | random 96-hex per process (with `WARN`)                                | HS256 signing key for session JWTs. **MUST** be ≥32 chars.                                             | **Yes**           |
| `COOKIE_SECRET`               | falls back to `JWT_SECRET`                                             | `@fastify/cookie` signing secret.                                                                      | **Yes**           |
| `COOKIE_SECURE`               | `true` in prod, `false` in dev                                         | Sets the `Secure` flag on session cookies; **MUST** be `1` behind HTTPS.                               | **Yes**           |
| `ADMIN_EMAIL`                 | `admin@gharsetu.local`                                                 | Bootstrap admin email created on first seed.                                                           | **Yes** (rotate)  |
| `ADMIN_PASSWORD`              | `ChangeMe!2026`                                                        | Bootstrap admin password. **MUST** be replaced after first deploy.                                     | **Yes**           |
| `ONDC_BAP_URI`                | `https://gharsetu.local/ondc/v1`                                       | Buyer App URI published in `context.bap_uri` for outbound test traffic.                                | Yes (real ONDC)   |
| `ONDC_BAP_ID`                 | `gharsetu.local`                                                       | Buyer App identifier.                                                                                  | Yes (real ONDC)   |
| `ONDC_BPP_URI`                | `https://gharsetu.local/ondc/v1`                                       | Seller App URI published in `context.bpp_uri` on outbound `on_*`.                                       | Yes (real ONDC)   |
| `ONDC_BPP_ID`                 | `gharsetu.local`                                                       | Seller App identifier.                                                                                 | Yes (real ONDC)   |
| `ONDC_DOMAIN`                 | `ONDC:RET11`                                                           | Beckn domain code.                                                                                     | Yes (real ONDC)   |
| `ONDC_COUNTRY`                | `IND`                                                                  | ISO country code.                                                                                      | No                |
| `ONDC_CITY`                   | `std:0792`                                                             | STD code (`0792` = Solan).                                                                             | No                |
| `RZP_KEY_ID`                  | `rzp_test_simulated`                                                   | Razorpay key id (test mode).                                                                           | **Yes**           |
| `RZP_KEY_SECRET`              | `simulated_secret_aaaaaaaaaaaaaa`                                      | Razorpay key secret.                                                                                   | **Yes**           |
| `RZP_WEBHOOK_SECRET`          | `simulated_webhook_secret`                                             | HMAC-SHA256 secret for `/pay/webhook` signature verification.                                          | **Yes**           |
| `DIGILOCKER_CLIENT_ID`        | `simulated_dl_client`                                                  | OAuth 2.0 client id for DigiLocker.                                                                    | **Yes**           |
| `DIGILOCKER_CLIENT_SECRET`    | `simulated_dl_secret`                                                  | OAuth 2.0 client secret for DigiLocker.                                                                | **Yes**           |
| `DIGILOCKER_REDIRECT_URI`     | `http://localhost:8080/verify/digilocker/callback`                     | Registered OAuth 2.0 redirect URI.                                                                     | **Yes**           |
| `DIGILOCKER_AUTH_URL`         | `https://api.digitallocker.gov.in/public/oauth2/1/authorize`           | DigiLocker authorise endpoint (used by the production code path).                                      | No                |
| `DIGILOCKER_TOKEN_URL`        | `https://api.digitallocker.gov.in/public/oauth2/1/token`               | DigiLocker token endpoint (used by the production code path).                                          | No                |
| `RATE_LIMIT_MAX`              | `200`                                                                  | Max requests per window per IP.                                                                        | No                |
| `RATE_LIMIT_WINDOW_MS`        | `60000`                                                                | Rate-limit window in milliseconds.                                                                     | No                |
| `DEFAULT_CITY`                | `Solan`                                                                | City used for home and search when geo and IP detection fail.                                          | No                |
| `DEFAULT_LANG`                | `en`                                                                   | Language used when both cookie and `Accept-Language` are absent.                                       | No                |

If `JWT_SECRET` is shorter than 32 characters, `src/config.ts` generates a 96-hex random secret per process and emits a structured `WARN` log; this is acceptable for development but **MUST NOT** occur in production because all sessions issued under the random secret are lost when the instance restarts.

---

## 6. Data model

The schema is defined once in `src/db/schema.sql` and applied unconditionally on boot through the multi-statement loader in `src/db/index.ts`. All `CREATE` statements use `IF NOT EXISTS`, so the file is idempotent. The PRAGMAs `journal_mode = WAL`, `foreign_keys = ON`, `synchronous = NORMAL` are set at the head of the file and re-asserted in `src/db/index.ts`.

All timestamps are stored as `INTEGER` epoch milliseconds. All identifiers are ULIDs (`src/lib/id.ts`), generated by `newId()` in `src/db/index.ts`. All money is stored as `INTEGER` rupees (no floats, no paise).

### 6.1 `users`

Authoritative identity record for students, owners, and admins. KYC fields are populated by `/verify/digilocker/callback` (see `src/routes/verification.ts`).

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','owner','admin')),
  preferred_lang TEXT DEFAULT 'en',
  kyc_verified INTEGER DEFAULT 0,
  kyc_method TEXT,
  kyc_payload TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
```

- `email` is unique and case-folded to lowercase by `emailSchema` in `src/lib/validate.ts`.
- `password_hash` is a bcrypt hash with cost 12 from `src/auth/password.ts`.
- `kyc_payload` is a sanitised JSON string. Full Aadhaar numbers **MUST NOT** be persisted (only the last four digits, year of birth, and the name on the ID).
- Read by `loadUser` in `src/auth/middleware.ts` and `src/routes/auth.ts`. Written by `/signup`, `/verify/digilocker/callback`.

### 6.2 `listings`

Owner-published room or PG records. `status='removed'` is a soft-delete tombstone — the row is excluded from all surfaces but retained for audit.

```sql
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  property_type TEXT CHECK(property_type IN ('single_room','shared_room','full_pg','flat')) NOT NULL,
  gender_pref TEXT CHECK(gender_pref IN ('male','female','any')) NOT NULL DEFAULT 'any',
  rent_monthly INTEGER NOT NULL,
  deposit INTEGER DEFAULT 0,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  near_landmark TEXT,
  amenities TEXT NOT NULL DEFAULT '[]',
  rules TEXT DEFAULT '[]',
  available_from INTEGER NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','rented','removed')),
  view_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_listings_city_status ON listings(city, status);
CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);
CREATE INDEX IF NOT EXISTS idx_listings_geo ON listings(lat, lng);
```

- `amenities` and `rules` are JSON-encoded arrays of strings (see `src/routes/listings.ts`).
- `view_count` is incremented on every successful `GET /listings/:id`.
- Written by `POST /listings`, `POST /listings/:id`, `POST /listings/:id/delete`.
- Read by `/`, `/search`, `/api/search`, `/listings/:id`, `/owner/dashboard`, and the ONDC `buildCatalog` helper in `src/routes/ondc.ts`.

### 6.3 `listing_images`

Images attached to a listing, ordered by `position` (zero-based). Up to six per listing are kept; uploads are normalised to WebP in `src/lib/images.ts` and stored under `UPLOADS_DIR`.

```sql
CREATE TABLE IF NOT EXISTS listing_images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_listing_images_listing ON listing_images(listing_id, position);
```

### 6.4 `bookings`

Visit and reserve requests from a student to an owner.

```sql
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  owner_id TEXT NOT NULL REFERENCES users(id),
  type TEXT CHECK(type IN ('visit','reserve')) NOT NULL,
  visit_at INTEGER,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled','completed')),
  ondc_order_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_owner ON bookings(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_student ON bookings(student_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_listing ON bookings(listing_id);
```

- `ondc_order_id` is reserved for federation traffic (a booking originated from an ONDC `confirm`).
- Written by `POST /bookings`, `POST /bookings/:id/decision`.
- Read by `/owner/dashboard`, `/student/dashboard`, `GET /pay/:bookingId`.

### 6.5 `payments`

Mirrors the Razorpay Orders API on the platform side.

```sql
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  payer_id TEXT NOT NULL REFERENCES users(id),
  payee_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  rzp_order_id TEXT NOT NULL UNIQUE,
  rzp_payment_id TEXT,
  rzp_signature TEXT,
  status TEXT DEFAULT 'created' CHECK(status IN ('created','captured','failed','refunded')),
  for_month TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_payee ON payments(payee_id);
```

- `amount` is in **rupees**, not paise. The Razorpay JSON response converts to paise on the wire by `* 100`.
- `rzp_order_id` is unique to prevent duplicate orders for the same upstream id.
- `for_month` is a `YYYY-MM` tag that lets a student make many monthly payments against the same listing.
- Written by `POST /pay/order` (`status='created'`) and `POST /pay/webhook` (`captured` / `failed`).

### 6.6 `renter_records`

The single source of truth for "did this student actually live here?" — gates the verified-renter badge on feedback (section 10).

```sql
CREATE TABLE IF NOT EXISTS renter_records (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  source TEXT CHECK(source IN ('owner_marked','platform_payment')) NOT NULL,
  active INTEGER DEFAULT 1,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE(listing_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_renter_student ON renter_records(student_id, active);
CREATE INDEX IF NOT EXISTS idx_renter_listing ON renter_records(listing_id, active);
```

- `UNIQUE(listing_id, student_id)` enforces "one renter record per (listing, student) pair", so the owner-mark and payment paths converge on a single row.
- Written by `POST /owner/listings/:lid/renters` (source `owner_marked`), `POST /pay/webhook` (source `platform_payment`), `POST /owner/listings/:lid/renters/:sid/end` (sets `active=0`, `ended_at`).
- Read by `POST /listings/:id/feedback` and `GET /owner/dashboard`.

### 6.7 `feedback`

Reviews on a listing. The `is_verified_renter` flag is decided server-side at write time and is not user-supplied.

```sql
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  is_verified_renter INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_listing ON feedback(listing_id, created_at DESC);
```

### 6.8 `audit_log`

Append-only event log. Every HTTP request and every mutating action writes a row. The `payload` column is JSON-encoded and **MUST NOT** contain raw secrets — see the redactor list in `src/logger.ts`.

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  ip TEXT,
  ua TEXT,
  payload TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_id, created_at DESC);
```

- Written by the `audit()` helper in `src/db/index.ts` and the global `onResponse` hook in `src/server.ts`.
- Read by `/admin`, `/admin/audit.json`, `/admin/audit/stream`.

### 6.9 `ondc_messages`

A verbatim transcript of the Beckn protocol envelopes that traverse the BPP surface. Useful for replay debugging and required for ONDC dispute arbitration.

```sql
CREATE TABLE IF NOT EXISTS ondc_messages (
  id TEXT PRIMARY KEY,
  txn_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  action TEXT NOT NULL,
  direction TEXT CHECK(direction IN ('in','out')) NOT NULL,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ondc_txn ON ondc_messages(txn_id, created_at);
```

- `direction='in'` records the inbound BAP request; `'out'` records the asynchronous BPP `on_<action>` envelope.
- Written by `logMessage()` in `src/routes/ondc.ts`.

### 6.10 `sessions`

JWT revocation list. The token itself is stateless HS256, but the `jti` claim is checked against this table on every authenticated request, so a logout invalidates the token immediately rather than waiting for `exp`.

```sql
CREATE TABLE IF NOT EXISTS sessions (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  revoked INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
```

---

## 7. HTTP surface

This section catalogues every route registered in `src/server.ts`. Routes are grouped by source file. All HTML routes share the locals contract built in `src/lib/render.ts:buildLocals` (`t`, `lang`, `user`, `csrf`, `flash`, `reqId`, `path`, `query`, `page`).

### 7.1 Health (`src/routes/health.ts`)

| Method | Path           | Auth | Purpose                                                                                |
|--------|----------------|------|----------------------------------------------------------------------------------------|
| GET    | `/healthz`     | None | Liveness. Returns `{ ok: true, ts }`. Allow-listed by the rate limiter.                |
| GET    | `/api/healthz` | None | Liveness alias. Identical body. Provided because Knative reserves `/healthz` on Cloud Run public URLs. |
| GET    | `/readyz`      | None | Readiness. Runs `SELECT 1` against the DB; returns 503 with `{ ok: false, reason }` on failure. |
| GET    | `/api/readyz`  | None | Readiness alias.                                                                       |

The Docker `HEALTHCHECK` directive uses `curl http://localhost:8080/healthz`, which works because the loopback path bypasses the Knative queue-proxy reservation.

### 7.2 Home and language (`src/routes/home.ts`)

| Method | Path     | Auth | Body schema | Side effects                                            |
|--------|----------|------|-------------|---------------------------------------------------------|
| GET    | `/`      | None | —           | Reads up to 6 most-recent active listings; renders `home.ejs`. |
| GET    | `/about` | None | —           | Renders `about.ejs`.                                    |
| POST   | `/lang`  | None | `{lang:'en'\|'hi', next:string}` | Sets `gs_lang` cookie (1 year), redirects to `next` if it begins with `/`. |

### 7.3 Capstone artefacts (`src/routes/pages.ts`)

| Method | Path           | Auth | Side effects                                                                                  |
|--------|----------------|------|-----------------------------------------------------------------------------------------------|
| GET    | `/report`      | None | Renders `report.ejs`, which `<%- include %>`s `_generated/report-body.ejs` (built by Python). |
| GET    | `/pitch`       | None | Renders `pitch.ejs` with the slide deck and keyboard controls.                                |
| GET    | `/report.docx` | None | 301 to `/static/downloads/Akshit_Thakur_Capstone_Report.docx`.                                |
| GET    | `/pitch.pptx`  | None | 301 to `/static/downloads/Akshit_Thakur_Capstone_Presentation.pptx`.                          |
| GET    | `/sw.js`       | None | Streams `src/public/sw.js` from the origin root with `Service-Worker-Allowed: /` so the worker can claim the entire scope. |

### 7.4 Auth (`src/routes/auth.ts`)

| Method | Path      | Auth | Body schema      | Side effects                                                                                                             |
|--------|-----------|------|------------------|--------------------------------------------------------------------------------------------------------------------------|
| GET    | `/signup` | None | —                | Renders `signup.ejs` (with optional `?next=`).                                                                           |
| POST   | `/signup` | None | `signupSchema`   | Validates, rejects duplicate `email` (409), bcrypts password, inserts `users` row, audits `user.signup`, issues JWT, sets `gs_session` cookie, redirects to `next`. |
| GET    | `/login`  | None | —                | Renders `login.ejs`.                                                                                                     |
| POST   | `/login`  | None | `loginSchema`    | Validates; on bad credentials audits `user.login_failed` and re-renders with field errors (401). On success audits `user.login`, issues JWT, sets cookie. |
| POST   | `/logout` | Any  | —                | Calls `revokeToken(jti)` if a session exists, audits `user.logout`, clears cookie, redirects to `/`.                     |

`safeNext()` defends against open-redirect: any `next` that does not start with `/` (or starts with `//`) collapses to `/`.

### 7.5 Search (`src/routes/search.ts`)

| Method | Path          | Auth | Query schema     | Response shape                                                                                              |
|--------|---------------|------|------------------|-------------------------------------------------------------------------------------------------------------|
| GET    | `/search`     | None | `searchSchema`   | HTML; `results`, `total`, `page`, `pageSize=20`, `pages`.                                                   |
| GET    | `/api/search` | None | `searchSchema`   | JSON `{ data: SearchRow[], meta: { total, page, page_size, pages } }`.                                      |

Filter precedence: `q` (substring match across title/description/address/landmark), `city` (case-insensitive equality), `min`/`max` rent, `property_type`, `gender` (matches own gender or `any`), `amenities` (post-filter, all wanted amenities **MUST** be present), `near_lat`/`near_lng` (post-filter sort by haversine distance from `src/lib/geo.ts`). Sort defaults to `recent`. Page size is hard-coded at 20.

When `amenities` or `near_*` are present, the SQL pulls all matching rows (no `LIMIT`) and pagination is applied in memory after JSON filtering. This is acceptable at MLP scale; section 22 tracks the eventual move to a generated-column index.

### 7.6 Listings (`src/routes/listings.ts`)

| Method | Path                    | Auth                   | Body schema                  | Side effects                                                                       |
|--------|-------------------------|------------------------|------------------------------|------------------------------------------------------------------------------------|
| GET    | `/listings/:id`         | None                   | —                            | Increments `view_count`; renders detail with images, owner snippet, feedback (limit 50), and aggregate rating. |
| GET    | `/listings/new`         | `owner`                | —                            | Renders empty `listing-form.ejs`.                                                  |
| POST   | `/listings`             | `owner`                | `listingSchema` (multipart)  | Inserts listing, processes up to 6 images via `saveImage()`, audits `listing.create`, redirects to detail. |
| GET    | `/listings/:id/edit`    | `owner` (must own)     | —                            | Renders `listing-form.ejs` in `mode='edit'`.                                       |
| POST   | `/listings/:id`         | `owner` (must own)     | `listingSchema` (multipart)  | Updates row, appends new images while existing+new ≤ 6, audits `listing.update`.  |
| POST   | `/listings/:id/delete`  | `owner` (must own)     | —                            | Soft-deletes via `status='removed'`, audits `listing.delete`, redirects to `/owner/dashboard`. |

Multipart parsing is implemented in `parseMultipart()`; field arrays are coalesced and oversize files are drained to keep the connection clean.

### 7.7 Bookings (`src/routes/bookings.ts`)

| Method | Path                       | Auth      | Body schema       | Side effects                                                                                    |
|--------|----------------------------|-----------|-------------------|-------------------------------------------------------------------------------------------------|
| POST   | `/bookings`                | `student` | `bookingSchema`   | Rejects self-booking (400), inserts `bookings` row with `status='pending'`, audits `booking.create` and `notify.owner_new_booking`. |
| POST   | `/bookings/:id/decision`   | `owner`   | `{decision:'accept'\|'decline'}` | Owner-only ownership check. Rejects already-decided bookings (409). Updates status, audits `booking.<status>` and `notify.student_booking_decision`. |

### 7.8 Feedback (`src/routes/feedback.ts`)

| Method | Path                          | Auth       | Body schema       | Side effects                                                                                  |
|--------|-------------------------------|------------|-------------------|-----------------------------------------------------------------------------------------------|
| POST   | `/listings/:id/feedback`      | Any signed-in | `feedbackSchema` | Looks up an active `renter_records` row OR a captured `payments` row for `(listing, author)`; if either exists, sets `is_verified_renter=1`; otherwise `0`. Audits `feedback.create` with the verified flag. |

### 7.9 Verification (`src/routes/verification.ts`) — DigiLocker simulation

| Method | Path                               | Auth | Side effects                                                                                            |
|--------|------------------------------------|------|---------------------------------------------------------------------------------------------------------|
| GET    | `/verify`                          | Any  | Renders `verify.ejs`, indicating current `kyc_verified` state.                                         |
| POST   | `/verify/digilocker/init`          | Any  | Audits `kyc.init`. Redirects to `/verify/digilocker/callback?code=SIM_<ulid>&state=<ulid>` (no real OAuth round-trip). |
| GET    | `/verify/digilocker/callback`      | Any  | Validates that `code` begins with `SIM_`. On success writes a sanitised payload (`aadhaar_last4='1234'`, `name_on_id`, `dob_year=2000`), sets `kyc_verified=1`, `kyc_method='digilocker'`. |

The production replacement (PKCE OAuth 2.0 against `DIGILOCKER_AUTH_URL`/`TOKEN_URL`) is documented as a comment block at the top of `src/routes/verification.ts`.

### 7.10 Payments (`src/routes/payments.ts`) — Razorpay simulation

| Method | Path                     | Auth      | Body / headers                                                  | Side effects                                                                                                     |
|--------|--------------------------|-----------|-----------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| GET    | `/pay/:bookingId`        | `student` | —                                                               | Loads booking and listing; rejects if not owned by student (404); renders `pay.ejs` with `keyId`, `amount`, `currency='INR'`. |
| POST   | `/pay/order`             | `student` | `{ booking_id?, listing_id?, amount?, for_month? }`             | Resolves listing (via booking or directly), inserts `payments` row with `status='created'`, audits `payment.order_create`. Returns a Razorpay-shaped Orders API response (`amount` in paise on the wire). |
| POST   | `/pay/webhook`           | None      | Header `x-razorpay-signature` (HMAC-SHA256 of raw body); body per Razorpay event schema. | Verifies signature with `crypto.timingSafeEqual`. On `payment.captured`: marks payment `captured`, persists `rzp_payment_id`, **upserts** a `renter_records` row with source `platform_payment` (re-activating if it existed). On `payment.failed`: marks `failed`. Bad signatures audit `payment.webhook_bad_sig` and 400. |

The webhook is the gateway through which a successful payment automatically promotes the payer to a verified renter (see section 10).

### 7.11 Owner (`src/routes/owner.ts`)

| Method | Path                                            | Auth                | Body                                  | Side effects                                                                                                                       |
|--------|-------------------------------------------------|---------------------|---------------------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| GET    | `/owner/dashboard`                              | `owner`             | —                                     | Renders the owner dashboard: own listings, last-100 bookings, last-100 renter records (active first).                              |
| POST   | `/owner/listings/:lid/renters`                  | `owner` (must own)  | `{ student_id?, student_email? }`     | Resolves the student (id or lower-cased email), upserts a `renter_records` row with source `owner_marked`, re-activating if needed. Audits `renter.mark`. |
| POST   | `/owner/listings/:lid/renters/:sid/end`         | `owner` (must own)  | —                                     | Sets `active=0`, `ended_at=now()` on the matching record. Audits `renter.end`.                                                     |

### 7.12 Student (`src/routes/student.ts`)

| Method | Path                  | Auth      | Side effects                                                                                          |
|--------|-----------------------|-----------|-------------------------------------------------------------------------------------------------------|
| GET    | `/student/dashboard`  | `student` | Renders the student dashboard: last 100 bookings (with listing title), payments, and own feedback.    |

### 7.13 Admin (`src/routes/admin.ts`)

| Method | Path                          | Auth    | Behaviour                                                                                                                              |
|--------|-------------------------------|---------|----------------------------------------------------------------------------------------------------------------------------------------|
| GET    | `/admin`                      | `admin` | Renders `admin.ejs` with the `limit` (default 200, max 1000) most recent `audit_log` rows and aggregate counts across the data model. |
| GET    | `/admin/audit.json`           | `admin` | JSON of `audit_log` rows (default 200, max 2000), optionally filtered by `?since=<epoch_ms>`, plus the same `counts` block.            |
| GET    | `/admin/audit/stream`         | `admin` | Server-Sent Events stream. Writes `event: audit\ndata: <row JSON>` for any row newer than the running `lastTs` watermark (initialised to `now() - 60_000`); ticks every 2 s and emits an `event: ping` heartbeat. |

### 7.14 ONDC (`src/routes/ondc.ts`)

All actions are mounted under `/ondc/v1/`. The handler is uniform: log the inbound envelope (`direction='in'`), validate that `context.action` matches the URL action (else NACK with `CONTEXT_ACTION_MISMATCH`), reply 200 with an ACK envelope, then dispatch the asynchronous `on_<action>` callback in the next event-loop tick. The outbound envelope is logged (`direction='out'`) and `POST`ed to `context.bap_uri/<on_action>`. Failures of the callback POST audit `ondc.callback_fail`.

| Method | Path                  | Inbound action | Async callback | Body shape                                                                                       |
|--------|-----------------------|----------------|----------------|--------------------------------------------------------------------------------------------------|
| POST   | `/ondc/v1/search`     | `search`       | `on_search`    | `{ context, message:{ intent } }`. Catalog generated by `buildCatalog()` from `intent.fulfillment.stops[0].location.city.name`, `intent.item.descriptor.name`, and an optional `intent.ondc_search` extension carrying `{ city, q, min, max }`. |
| POST   | `/ondc/v1/select`     | `select`       | `on_select`    | Echoes the `order` with a stub `quote` (`PT15M` TTL).                                            |
| POST   | `/ondc/v1/init`       | `init`         | `on_init`      | Echoes the `order` and adds a `payment` block (`type='PRE-FULFILLMENT'`, `collected_by='BPP'`).  |
| POST   | `/ondc/v1/confirm`    | `confirm`      | `on_confirm`   | Assigns `order.id = ondc_<ulid>`, `state='Created'`, `created_at=ISO`.                           |
| POST   | `/ondc/v1/status`     | `status`       | `on_status`    | Returns `order.state='Created'` for any inbound `order_id`.                                      |
| POST   | `/ondc/v1/cancel`     | `cancel`       | `on_cancel`    | Returns `order.state='Cancelled'`.                                                               |
| POST   | `/ondc/v1/update`     | `update`       | `on_update`    | Echoes `order` with `updated_at=ISO`.                                                            |
| POST   | `/ondc/v1/rating`     | `rating`       | `on_rating`    | Returns a `feedback_form` with the BPP rating form URL.                                          |
| POST   | `/ondc/v1/support`    | `support`      | `on_support`   | Returns a stub support phone, email, and URI.                                                    |
| GET    | `/ondc/v1/lookup`     | —              | —              | Returns a registry-shaped subscriber descriptor for GharSetu (BPP, status `SUBSCRIBED`, simulated `signing_public_key`). |

The Beckn ACK envelope is `{ message: { ack: { status: "ACK" } } }`. NACK responses additionally carry `{ error: { code, message } }`. Every inbound and outbound payload is appended to `ondc_messages` indexed by `(txn_id, created_at)` for replay.

The production replacement — Ed25519 request signing per the ONDC API contract, registry-side subscriber lookup, schema validation per Beckn JSON Schema, replay protection over `(transaction_id, message_id)` for 24 h — is documented as a comment block at the top of `src/routes/ondc.ts`.

---

## 8. Authentication and authorisation

### 8.1 Token format

| Property        | Value                                                                                                  |
|-----------------|--------------------------------------------------------------------------------------------------------|
| Algorithm       | HS256                                                                                                  |
| Secret          | `JWT_SECRET` from env (≥32 chars **MUST**); ephemeral random fallback only in non-prod.               |
| Expiry          | 7 days (`expiresIn: "7d"`)                                                                             |
| Claims          | `sub` (user id, ULID), `role` (`student\|owner\|admin`), `jti` (ULID), `iat`, `exp`                    |
| Issued by       | `issueToken()` in `src/auth/jwt.ts`                                                                    |
| Revocation      | `sessions(jti, revoked)` row checked by `verifyToken()` on every request.                              |

### 8.2 Cookie

| Attribute       | Value                                                                                                  |
|-----------------|--------------------------------------------------------------------------------------------------------|
| Name            | `gs_session`                                                                                            |
| Path            | `/`                                                                                                    |
| HttpOnly        | `true`                                                                                                 |
| Secure          | `true` when `COOKIE_SECURE=1` (prod); `false` for local HTTP development.                              |
| SameSite        | `Lax`                                                                                                  |
| Max-Age         | 7 days, in seconds, derived from `COOKIE_MAX_AGE_MS`.                                                  |
| Set by          | `POST /signup`, `POST /login`. Cleared by `POST /logout`.                                              |

### 8.3 Session loading

`loadUser` runs as the global `onRequest` hook (`src/server.ts`). It reads the cookie, calls `verifyToken()` (which checks signature, expiry, and the `sessions.revoked` flag), and attaches the resolved `User` to `req.user`.

### 8.4 CSRF

`@fastify/csrf-protection` is registered with `cookieOpts: { signed: false, sameSite: 'lax', path: '/' }`. The token is exposed to templates via `reply.generateCsrf()` (called from `buildLocals` in `src/lib/render.ts`), and forms include `<input type="hidden" name="_csrf">`. The `onRequest` order **MUST** keep `loadUser` before any state-changing POST validation. CSRF errors surface as `FST_CSRF_INVALID_TOKEN` / `FST_CSRF_MISSING_SECRET` and are rendered with the localised `error.csrf` message in `src/server.ts:setErrorHandler`.

### 8.5 Role authorisation

`requireAuth(roles?)` in `src/auth/middleware.ts` is the only authorisation gate. Passing no `roles` argument allows any signed-in user.

| Route                                          | Allowed roles            |
|------------------------------------------------|--------------------------|
| `GET /listings/new`, `POST /listings`, edit/delete | `owner`              |
| `POST /bookings`                               | `student`                |
| `POST /bookings/:id/decision`                  | `owner`                  |
| `POST /listings/:id/feedback`                  | any (student/owner/admin) |
| `GET /verify`, `/verify/digilocker/*`          | any                      |
| `GET /pay/:bookingId`, `POST /pay/order`       | `student`                |
| `POST /pay/webhook`                            | none (HMAC-verified)     |
| `GET /owner/dashboard`, `/owner/listings/...`  | `owner`                  |
| `GET /student/dashboard`                       | `student`                |
| `GET /admin`, `/admin/*`                       | `admin`                  |
| Beckn `/ondc/v1/*`                             | none (signed in prod)    |

### 8.6 Password rules

`passwordSchema` in `src/lib/validate.ts` requires 10–128 characters; bcrypt cost 12 (`src/auth/password.ts`). The form layer **SHOULD NOT** echo passwords back to the client and **MUST NOT** persist them in the audit log (the redactor in `src/logger.ts` strips `*.password` and `*.password_hash`).

---

## 9. Rate limiting

`@fastify/rate-limit` is registered globally with `max=RATE_LIMIT_MAX` (default 200) requests per `RATE_LIMIT_WINDOW_MS` (default 60 000 ms) per IP. `/healthz` and `/readyz` are allow-listed so probes never trip the limiter. A 429 response is returned as JSON `{ error: { code: "RATE_LIMITED", message } }` regardless of `Accept`.

---

## 10. The verified-renter algorithm

This is the one normative claim end-users perceive directly: a feedback row carries the verified-renter badge if and only if the author can be proved to have rented the listing. The pseudocode is:

```
is_verified_renter(listing, author) :=
  EXISTS renter_records r
    WHERE r.listing_id = listing.id
      AND r.student_id = author.id
      AND r.active = 1
      AND r.source IN ('owner_marked', 'platform_payment')
```

In the implementation (`src/routes/feedback.ts`), the SQL is split into two existence checks and OR-combined, because the `payments` row may exist before the `renter_records` row is created on a slow webhook. Both paths converge on the same boolean.

### 10.1 Creation paths

- **Owner-marked.** `POST /owner/listings/:lid/renters` with `{ student_id }` or `{ student_email }` (`src/routes/owner.ts`). The owner is the source of truth for "yes, this person lives here".
- **Platform payment.** `POST /pay/webhook` (`src/routes/payments.ts`) with `event='payment.captured'`. The webhook upserts a `renter_records` row with `source='platform_payment'` for the payer-listing pair.

### 10.2 Uniqueness

`UNIQUE(listing_id, student_id)` on `renter_records` ensures that the two creation paths cannot diverge into two rows. If a payment captures after an owner has marked the renter (or vice versa), the second path **MUST** update the existing row rather than insert a duplicate (both code paths do this today).

### 10.3 Termination

`POST /owner/listings/:lid/renters/:sid/end` (`src/routes/owner.ts`) sets `active=0` and stamps `ended_at`. A subsequent re-mark **MUST** re-activate the same row.

---

## 11. Internationalisation

### 11.1 File layout

```
src/locales/
├── en.json
└── hi.json
```

Each file is a flat dictionary `{ "key.path": "translated string" }`. Keys use dotted namespacing (`listing.h.feedback`). `{name}` placeholders are interpolated by `t()` in `src/i18n.ts`.

### 11.2 Key conventions

- One key per displayed string. **MUST NOT** concatenate translated fragments at runtime.
- Key prefixes: `app.*` brand strings, `nav.*` navigation, `home.*`/`search.*`/`listing.*`/`auth.*`/etc. by surface, `error.*` for error pages, `common.*` for buttons reused everywhere.

### 11.3 Detection and fallback

`detectLang()` in `src/i18n.ts` returns the first match of:

1. `gs_lang` cookie (`en`/`hi`).
2. The first `Accept-Language` token starting with `hi` resolves to `hi`.
3. Else `DEFAULT_LANG` (env), else `en`.

Missing keys fall back to the English dictionary, then to the literal key (so missing translations are visible during review). The cookie is set by `POST /lang` and retained for one year.

### 11.4 Adding a language

1. Create `src/locales/<lang>.json` with the same keys as `en.json`.
2. Import and register in `src/i18n.ts:dicts`.
3. Add the lang option to the language switcher partial.
4. Verify text expansion against the longest key (German is the worst case; Hindi is comparable to English).

CSS uses logical properties (`margin-inline-start`, `padding-inline`, `text-align: start`) so adding an RTL language requires only `<html dir="rtl">` plus a per-locale font stack.

---

## 12. Accessibility (WCAG 2.2 AAA)

GharSetu treats accessibility as a primary feature. The following are normative.

| Concern                | Requirement                                                                                                                                  |
|------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| Contrast               | Body text ≥ 7:1; large text and UI components ≥ 4.5:1.                                                                                       |
| Focus indicator        | `:focus-visible` outline ≥ 2 px solid in a colour with ≥ 3:1 contrast against both adjacent backgrounds; ≥ 2 px offset.                     |
| Tap target             | All interactive surfaces ≥ 44 × 44 CSS pixels.                                                                                               |
| Skip link              | First focusable element on every page is a "Skip to main content" link (key `nav.skip`) targeting `#main`.                                  |
| Landmarks              | Every page renders `header` (with `role="banner"`), `nav`, `main`, `footer`. Forms have a `<fieldset>`+`<legend>` per group.                 |
| Keyboard navigation    | Every interactive control reachable in DOM order; no positive `tabindex`.                                                                    |
| Screen-reader regions  | Flash messages use `role="status"` (`aria-live="polite"`); errors use `role="alert"` (`aria-live="assertive"`). The slide-deck counter uses `aria-live="polite"`. |
| Reduced motion         | Carousel auto-advance and parallax effects respect `prefers-reduced-motion: reduce`.                                                         |
| Forced colours         | Layout uses `system-color()` keywords or transparent borders that survive `forced-colors: active`.                                           |
| Form errors            | Each invalid field is associated with its message via `aria-describedby="<field>-err"`.                                                      |
| Lang attribute         | `<html lang="<en\|hi>">` set per request from `detectLang()`.                                                                                |

### 12.1 Pitch deck shortcuts (`src/routes/pages.ts`, `src/views/pitch.ejs`)

| Key            | Action                |
|----------------|-----------------------|
| Left arrow     | Previous slide        |
| Right arrow    | Next slide            |
| `F`            | Toggle fullscreen     |
| `Esc`          | Exit fullscreen       |
| `Tab` / `Shift+Tab` | Move focus through Prev / counter / Next / Download |

The counter announces position politely (`<span aria-live="polite" aria-atomic="true">N / M</span>`).

---

## 13. Performance budget

GharSetu is engineered for slow phones on intermittent 2G/3G in tier-2/3 Indian cities. SSR-first rendering, no client framework, and ephemeral storage on the same node as compute keep first-byte and first-paint low.

| Asset                      | Target              | Notes                                                                                       |
|----------------------------|---------------------|---------------------------------------------------------------------------------------------|
| Home HTML (compressed)     | ≤ 25 KiB            | Inline critical CSS in `layout.ejs`; no above-the-fold JS.                                  |
| Total CSS                  | ≤ 40 KiB            | Single sheet at `/static/styles.css`; no preprocessor, no PostCSS pipeline.                 |
| Total JS                   | ≤ 25 KiB initial    | Vanilla modules; Leaflet is loaded lazily only on `/search` (map view) and `/listings/:id`. |
| Listing image (display)    | ≤ 60 KiB            | WebP at quality 78, max 1600×1200, generated by `sharp` in `src/lib/images.ts`.             |
| Total page weight (cold)   | ≤ 200 KiB           | Service worker pre-caches the shell after the first visit.                                  |
| Cold start (Cloud Run)     | ≤ 1.5 s             | `min-instances=0`; cold start is the first byte after scale-to-zero.                        |
| Warm p50 latency           | ≤ 80 ms             | SQLite reads in WAL mode; no network DB hop.                                                |
| Warm p95 latency           | ≤ 250 ms            |                                                                                              |

**Rendering rules.**

- **MUST** be server-rendered first; client JS is for enhancement (lang switcher, search filters, pitch deck) only.
- **MUST NOT** ship a client-side framework (no React, Vue, Svelte). EJS plus vanilla JS only.
- **MUST** lazy-load Leaflet via `<script defer>` only on routes that show a map.
- **MUST** stream images from `/uploads/*` with a 30-day immutable cache header in production (set in `src/server.ts`).

---

## 14. Observability

### 14.1 Pino schema

Pino is configured in `src/logger.ts` with base fields `service: 'gharsetu'`, `env`, `pid`, and a `ts` epoch-ms field. A representative request log:

```json
{"level":"info","ts":1714665900123,"service":"gharsetu","env":"production","pid":17,"reqId":"01J...","msg":"request completed","req":{"method":"POST","url":"/bookings","headers":{"authorization":"[REDACTED]"}},"res":{"statusCode":302},"responseTime":17}
```

### 14.2 Redactor list

The pino redactor (`src/logger.ts`) censors:

- `req.headers.authorization`
- `req.headers.cookie`
- `req.headers["set-cookie"]`
- `*.password`
- `*.password_hash`
- `*.kyc_payload`
- `*.rzp_signature`

These paths **MUST** never appear in plaintext in either the JSON logs or the `audit_log` payload column. New PII fields **MUST** be added to this list before the field is logged.

### 14.3 Audit log

Every request emits a row through the `onResponse` hook in `src/server.ts` (`action='http'`, `entity='request'`, payload `{method, url, status, ms}`). Every mutating route additionally emits a domain-specific row (`booking.create`, `payment.captured`, `feedback.create`, etc.). See section 6.8 for the schema.

### 14.4 SIEM-style admin

`/admin` (`src/routes/admin.ts`) renders the most recent 200 audit rows alongside aggregate counts. `/admin/audit/stream` is a Server-Sent Events feed: every two seconds the server queries for rows newer than the running watermark and writes `event: audit\ndata: <row JSON>\n\n`, plus a `event: ping` heartbeat. The stream cleans up on `req.raw.close`. Up to 200 rows are emitted per tick.

### 14.5 Health semantics

- `/healthz` (and `/api/healthz`) **MUST** return 200 with `{ ok: true, ts }` whenever the process is alive.
- `/readyz` (and `/api/readyz`) **MUST** return 503 with `{ ok: false, reason }` if `SELECT 1` fails.
- The Knative queue-proxy on Cloud Run reserves `/healthz` on the public URL; `/api/healthz` is the externally reachable alias. The Docker `HEALTHCHECK` uses `curl http://localhost:8080/healthz`, which works because the loopback path bypasses the proxy.

---

## 15. Build pipeline

```
npm run build  step 1: python3 scripts/render_pages.py    # docx/pptx -> HTML fragments
              step 2: tsc -p tsconfig.json                # TypeScript -> dist/*.js
              step 3: cp -r src/views   dist/views        # EJS templates (incl. _generated/)
              step 4: cp -r src/locales dist/locales      # i18n dicts
              step 5: cp -r src/public  dist/public       # CSS, JS, sw.js, manifest, icons, downloads
              step 6: cp src/db/schema.sql dist/db/schema.sql  # runtime schema loader
```

### 15.1 `scripts/render_pages.py`

Re-runnable. Reads `Akshit_Thakur_Capstone_Report.docx` and `Akshit_Thakur_Capstone_Presentation.pptx` from the repo root. Emits:

| Artefact                                              | Purpose                                                                  |
|-------------------------------------------------------|--------------------------------------------------------------------------|
| `src/views/_generated/report-body.ejs`                | TOC sidebar plus `<article>` body with semantic headings, lists, and tables. |
| `src/views/_generated/pitch-body.ejs`                 | Slide deck markup (`<section class="slide">`) with absolute-positioned shapes, plus a control bar and keyboard help text. |
| `src/public/downloads/Akshit_Thakur_Capstone_Report.docx` | Verbatim copy for the on-page download button.                       |
| `src/public/downloads/Akshit_Thakur_Capstone_Presentation.pptx` | Verbatim copy for the on-page download button.                  |

Heading slugs are deterministic and de-duplicated (`section`, `section-2`, etc.) so the TOC links survive re-runs. The script exits non-zero if either source file is missing.

### 15.2 TypeScript compile

`tsc -p tsconfig.json` compiles `src/**/*.ts` to `dist/**/*.js` with strict mode (`strict`, `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`). Module format is `NodeNext`; target is `ES2023`.

### 15.3 Tests

`npm test` runs `node --test tests/smoke.mjs`, which spawns the server with an isolated SQLite file in `/tmp`, waits for `/healthz`, and runs a small acceptance suite (home renders, search returns Solan listings, signup then login issues a session cookie, student can POST `/bookings`, `/pay/order` returns an `order_<ulid>`, `/ondc/v1/search` returns ACK, `/admin` is gated).

---

## 16. Container and deployment

### 16.1 Dockerfile (`Dockerfile`)

Two-stage build:

- **Builder.** `node:22-bookworm-slim` plus `python3`, `python3-pip`, `make`, `g++`, `pkg-config`, `libvips-dev`, `libsqlite3-dev`. `pip install python-docx==1.1.0 python-pptx==1.0.2 Pillow`. Runs `npm ci --include=dev`, then `npm run build`, then `npm prune --omit=dev`.
- **Runtime.** `node:22-bookworm-slim` plus `libvips42`, `libsqlite3-0`, `tini`, `curl`. Copies `node_modules`, `dist`, and `package.json` from the builder. `mkdir /tmp/uploads && chown node:node /tmp/uploads`. Runs as non-root `node`. `ENTRYPOINT ["/usr/bin/tini","--"]`, `CMD ["node","dist/server.js"]`. `HEALTHCHECK` uses `curl -fsS http://localhost:8080/healthz`.

Python is intentionally absent from the runtime image; it is needed only to render the report and pitch HTML, which the builder bakes into `dist/views/_generated/`.

### 16.2 Cloud Run runtime

| Setting           | Value                                                                                  |
|-------------------|----------------------------------------------------------------------------------------|
| Region            | `asia-south1` (Mumbai)                                                                 |
| Memory            | `512Mi`                                                                                |
| CPU               | `1`                                                                                    |
| Concurrency       | `80`                                                                                   |
| Min instances     | `0`                                                                                    |
| Max instances     | `10`                                                                                   |
| Request timeout   | `300 s`                                                                                |
| Port              | `8080`                                                                                 |
| Auth              | `--allow-unauthenticated` (public URL)                                                 |

### 16.3 Secret bindings

The Cloud Run revision sets the following bindings via `--set-secrets` (see `cloudbuild.yaml`):

| Env var                     | Secret name              | Version  | IAM role on the secret                            |
|-----------------------------|--------------------------|----------|---------------------------------------------------|
| `JWT_SECRET`                | `jwt-secret`             | `latest` | `roles/secretmanager.secretAccessor` for runtime SA |
| `RZP_KEY_SECRET`            | `rzp-secret`             | `latest` | same                                              |
| `RZP_WEBHOOK_SECRET`        | `rzp-webhook-secret`     | `latest` | same                                              |
| `DIGILOCKER_CLIENT_SECRET`  | `digilocker-secret`      | `latest` | same                                              |
| `ADMIN_PASSWORD`            | `admin-password`         | `latest` | same                                              |

Plain env vars set on the same revision: `NODE_ENV=production`, `LOG_LEVEL=info`, `SEED_ON_START=1`, `DB_PATH=/tmp/gharsetu.db`, `UPLOADS_DIR=/tmp/uploads`, `COOKIE_SECURE=1`.

### 16.4 Custom domain

```
gcloud beta run domain-mappings create \
  --service=gharsetu --region=asia-south1 \
  --domain=gharsetu.example
```

Add the four `CNAME`/`A` records emitted by `gcloud beta run domain-mappings describe ... --format='value(status.resourceRecords[])'` to the DNS zone. Certificate provisioning is automatic and typically completes within 30 minutes.

---

## 17. Simulated external systems

### 17.1 DigiLocker (`src/routes/verification.ts`)

**What the simulation does.** `/verify/digilocker/init` skips the OAuth round-trip and directly redirects to `/verify/digilocker/callback?code=SIM_<ulid>&state=<ulid>`. The callback validates the `SIM_` prefix, marks `kyc_verified=1`, and stores a sanitised payload (`aadhaar_last4='1234'`, `name_on_id`, `dob_year=2000`).

**Production replacement.** `src/routes/verification.ts` carries a complete header comment with the real PKCE OAuth 2.0 flow against `DIGILOCKER_AUTH_URL`/`TOKEN_URL`, including the `state` and `code_challenge` storage table (`digilocker_pkce`), the token exchange, and the `Aadhaar` scope. The sanitised-payload contract **MUST** be preserved (no full Aadhaar number stored).

**Testing strategy.** Use the DigiLocker sandbox at `api-sandbox.digilocker.gov.in` with `client_id` registered through MeitY. Verify: state round-trip, code expiry rejection, signed JWT issued by DigiLocker, idempotency on retry, that `kyc_payload` redaction holds in audit_log.

### 17.2 Razorpay (`src/routes/payments.ts`)

**What the simulation does.** `POST /pay/order` mints `rzp_order_id = order_<ulid>` locally and returns the response in the exact shape of the real Razorpay Orders API (with `amount` in paise on the wire). `POST /pay/webhook` performs **real** HMAC-SHA256 verification of the raw body against `RZP_WEBHOOK_SECRET` using `crypto.timingSafeEqual` — only the order creation is mocked; the signature path is production-ready.

**Production replacement.** Drop in the `razorpay` Node SDK, replace the local `order_<ulid>` mint with `rzp.orders.create(...)`, and switch `RZP_KEY_ID`/`RZP_KEY_SECRET` to live keys. The webhook handler requires no change beyond pointing the dashboard webhook URL at `https://<host>/pay/webhook` and copying the secret to Secret Manager.

**Testing strategy.** Razorpay test cards (4111-1111-1111-1111). Send a manual POST with a forged signature to verify the 400 plus `payment.webhook_bad_sig` audit row. Verify the `payment.captured` to `renter_records` upsert path with both fresh and pre-existing renter rows.

### 17.3 ONDC / Beckn (`src/routes/ondc.ts`)

**What the simulation does.** Implements the full `search/select/init/confirm/status/cancel/update/rating/support` request/response choreography. Inbound requests get a 200 ACK immediately; the asynchronous `on_<action>` callback is dispatched in the next event-loop tick and POSTed to `context.bap_uri`. Outbound payloads are not signed.

**Production replacement.** Three additions: (a) inbound `Authorization` header verification per the ONDC signing spec (Ed25519 over a `(created)` / `(expires)` / SHA-512 `digest` signing string), with the signer's public key fetched from the ONDC Registry (`https://registry.ondc.org/lookup`); (b) outbound request signing using a per-subscriber Ed25519 keypair stored in Secret Manager; (c) JSON Schema validation of every Beckn message against the published RET11/Services schema. Replay protection over `(transaction_id, message_id)` for 24 h is also required.

**Testing strategy.** ONDC Pre-Production environment with a sandbox BAP. Verify: signature verification (positive and negative), schema validation rejects unknown fields per `additionalProperties: false`, all `on_<action>` callbacks delivered within 30 s SLA, retry policy on 5xx from BAP (max 3 retries with exponential backoff). Run against the official Beckn protocol vendor-validator before submitting for ONDC certification.

---

## 18. Operational runbook

### 18.1 Health check failing

1. Hit `/api/readyz` from outside Cloud Run. If 503 with `reason='db_unhealthy'`, the `/tmp` filesystem is full or the WAL is corrupt.
2. Stream `gcloud run services logs tail gharsetu --region=asia-south1` and look for `db.ready` (boot) and `request.error` (runtime).
3. If the WAL is corrupt, the recovery is to roll a new revision (since `/tmp` is per-instance ephemeral); re-seed runs automatically because the new instance starts with an empty DB. The WAL file is at `/tmp/gharsetu.db-wal`.

### 18.2 Cold start spike

A spike in p99 immediately after a quiet period is almost always the first request after scale-to-zero. Mitigate with a Cloud Run uptime check (Cloud Monitoring) hitting `/healthz` every 60 s. Do not raise `min-instances` above 0 unless you have accepted the idle cost.

### 18.3 TLS certificate not provisioning

```
gcloud beta run domain-mappings describe \
  --domain=gharsetu.example --region=asia-south1 \
  --format='yaml(status.conditions)'
```

Inspect each condition's `status` and `message`. The most common cause is a CAA record on the apex zone that excludes Google. The second most common is a stale `CNAME` pointing to a previous mapping.

### 18.4 Audit log filling `/tmp`

`audit_log` rows are bounded by traffic and live in the SQLite file under `/tmp`, which is bounded by the Cloud Run memory budget (`/tmp` is a tmpfs on Cloud Run). At MLP traffic this is comfortable. If sustained traffic begins to pressure memory, migrate the storage tier to Cloud SQL for PostgreSQL (`asia-south1`); section 22 lists the schema-migration steps.

### 18.5 Forgot admin password

The admin user is seeded once when `users` is empty (`SEED_ON_START=1`, see `src/server.ts` and `src/db/seed.ts`). To rotate:

1. Update the `admin-password` Secret Manager version: `printf "%s" "<new>" | gcloud secrets versions add admin-password --data-file=-`.
2. Trigger a new revision (`gcloud run services update gharsetu --region=asia-south1`). On a fresh instance with an empty DB, the new password is used. On an existing instance, manually update the `users.password_hash` row from a one-off script or simply scale to zero and back (since `/tmp` is wiped, the next boot will re-seed with the new password).

---

## 19. Security posture

### 19.1 STRIDE-lite

| Threat                  | Mitigation                                                                                                                                       |
|-------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| Spoofing                | bcrypt cost-12 password hashing. JWT HS256 with secret in Secret Manager. Session revocation via `sessions(jti)`. CSRF double-submit cookie on every state-changing form. Razorpay webhook HMAC-SHA256 with constant-time compare. |
| Tampering               | All inputs validated through zod schemas at the route boundary (`src/lib/validate.ts`). Multipart files reject anything not in `image/{jpeg,png,webp,heic,heif}`, capped at 8 MiB and 6 files. `next` redirect parameter sanitised by `safeNext()`. |
| Repudiation             | `audit_log` row on every HTTP request and every mutation, indexed by `(actor_id, created_at)`. Pino structured logs with request id (ULID) propagated to the audit row. ONDC envelopes mirrored to `ondc_messages` indexed by `(txn_id, created_at)`. |
| Information disclosure  | Pino redactor list strips `authorization`, `cookie`, `set-cookie`, `*.password`, `*.password_hash`, `*.kyc_payload`, `*.rzp_signature`. `kyc_payload` stores only `aadhaar_last4`, `name_on_id`, `dob_year`. Cookie attributes `HttpOnly` plus `SameSite=Lax` plus `Secure` (in prod). Static error pages do not leak stack traces; the request id is the only correlation handle. |
| Denial of service       | `@fastify/rate-limit` 200 req/min per IP (configurable). Fastify body limit 10 MiB; multipart 8 MiB by 6. SSE stream cleans up on `req.raw.close`. SQLite WAL with `synchronous=NORMAL` keeps writes O(1). |
| Elevation of privilege  | `requireAuth(roles)` is the only authorisation gate; ownership checks are explicit (e.g. `listing.owner_id !== user.id` returns 403). The admin role is reserved for `/admin/*` and **MUST NOT** be granted via the public signup form (`signupSchema` only admits `student`/`owner`). |

### 19.2 Compliance

- **DPDP Act 2023.** Consent collected at signup (English plus Hindi notice). PII fields are minimised: only `email`, `full_name`, optional `phone`, optional `kyc_payload` (sanitised). Deletion is supported by removing the user row plus their listings/bookings/payments through cascading foreign-key intent (currently a manual SQL script; a self-service flow is tracked in section 22). Audit log redaction list applies to PII paths.
- **GDPR.** Same minimisation. Lawful basis is contractual necessity for the rental relationship and consent for KYC.
- **Data residency.** Cloud Run `asia-south1` is Mumbai. Cloud SQL (when introduced) **MUST** also be `asia-south1`. Backups **MUST NOT** cross the regional boundary.
- **Encryption.** Cloud Run terminates TLS 1.3 in front of the container. Secret Manager uses Google-managed keys; the runtime SA reads them at boot. Application-layer encryption is not used because there is no use case for envelope encryption beyond what Secret Manager already provides.

---

## 20. Versioning and compatibility

The project follows semantic versioning. The HTTP route surface in section 7 is the public contract.

- **Patch** (0.1.x). Bug fixes that do not change the schema, the route surface, or any response shape.
- **Minor** (0.x.0). Backwards-compatible additions: new routes, new optional fields, new env vars with defaults.
- **Major** (x.0.0). Breaking changes to the route surface, removal of fields, schema migrations that require down-time.

Breaking changes require: (a) a new major version, (b) a deprecation window of at least one minor release where the old surface logs `WARN` on use, (c) an entry in section 23.

The Beckn protocol surface is versioned independently via `context.core_version` (currently `1.2.0`).

---

## 21. Out-of-band hooks (production ONDC)

When a real ONDC subscription replaces the simulated surface, the following **MUST** be added to the configuration:

```env
ONDC_REGISTRY_URL=https://registry.ondc.org
ONDC_GATEWAY_URL=https://pgwy.ondc.org/v2/
ONDC_SUBSCRIBER_ID=gharsetu.example
ONDC_SUBSCRIBER_URL=https://gharsetu.example/ondc/v1
ONDC_UNIQUE_KEY_ID=k1
ONDC_SIGNING_PRIVATE_KEY=<base64 ed25519 32-byte secret>
ONDC_ENCR_PRIVATE_KEY=<base64 x25519 32-byte secret>
```

Key rotation policy: Ed25519 signing keys **MUST** be rotated every 12 months, or immediately on suspected compromise. A new `unique_key_id` (`k2`, `k3`, etc.) **MUST** be subscribed at the registry before the old one is retired; both keys remain valid through the overlap window.

The BAP/BPP IDs **MUST** match the registered `subscriber_id`. The BAP and BPP roles **MUST** be subscribed separately, even if served from the same domain, because the signing key sets are scoped per subscriber type.

---

## 22. Open issues / TODOs

These are honest known limitations of the MLP. They do not block the capstone defense; they bound it.

1. **Ephemeral storage.** `/tmp/gharsetu.db` is per-instance and lost on revision rollover or scale-to-zero. Suitable for the demo and seeded-only flows. A real launch **MUST** migrate to Cloud SQL for PostgreSQL in `asia-south1`. Schema is portable (no SQLite-specific syntax beyond the PRAGMAs and the implicit `INTEGER` typing); the migration script is straightforward.
2. **Image storage.** `/tmp/uploads/*.webp` is also ephemeral. Real launch **MUST** move to Cloud Storage (`asia-south1`) with a CDN in front; the route handler in `src/routes/listings.ts` writes through `saveImage()` so swapping the storage adapter is one file.
3. **ONDC signing.** Outbound `on_<action>` envelopes are not Ed25519-signed (see section 17.3). Required before ONDC certification.
4. **DigiLocker.** OAuth 2.0 PKCE flow is stubbed (see section 17.1). Required before production identity verification.
5. **Search filtering.** `amenities` and `near_lat/near_lng` filters are post-SQL (in-memory). Acceptable below ten thousand listings; replace with a generated column or a JSON1 `EXISTS` predicate as scale grows.
6. **Self-service deletion.** DPDP-style "delete my account" is a manual SQL script today. A user-facing flow is required before public launch.
7. **Notification delivery.** `notify.owner_new_booking` and `notify.student_booking_decision` are audit rows only — no real email/SMS is dispatched. Wire up an MSG91/SendGrid adapter on the `notify.*` audit hook before public launch.
8. **Tests.** `tests/smoke.mjs` covers the happy paths only. Property tests for the verified-renter algorithm and a fuzz test for the search query parser are tracked.

---

## 23. Change log

- `v0.1.0` — Initial MLP release. Single-region Cloud Run deployment. Simulated DigiLocker / Razorpay / ONDC integrations. English plus Hindi parity. WCAG 2.2 AAA accessibility. Server-rendered EJS, no client framework. SQLite ephemeral storage on `/tmp`.
