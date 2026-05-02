<p align="center">
  <img src="src/public/icons/icon-192.png" width="120" height="120" alt="GharSetu logo" />
</p>

<h1 align="center">GharSetu</h1>

<p align="center"><em>Apna kamra, apne sheher mein.</em></p>

<p align="center">
  Localized PG and room rental for university students. ONDC-connected. Cloud Run deployable.
</p>

<p align="center">
  <a href="https://gharsetu.dmj.one"><img alt="Cloud Run live" src="https://img.shields.io/badge/cloud%20run-live-success?logo=googlecloud&logoColor=white"></a>
  <a href="https://nodejs.org/"><img alt="Node 22" src="https://img.shields.io/badge/node-22%20LTS-339933?logo=nodedotjs&logoColor=white"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript 5.7" src="https://img.shields.io/badge/typescript-5.7-3178c6?logo=typescript&logoColor=white"></a>
  <a href="https://fastify.dev/"><img alt="Fastify 5" src="https://img.shields.io/badge/fastify-5-000000?logo=fastify&logoColor=white"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="https://www.w3.org/WAI/standards-guidelines/wcag/"><img alt="WCAG 2.2 AAA" src="https://img.shields.io/badge/WCAG-2.2%20AAA-7b1fa2"></a>
  <a href="https://ondc.org/"><img alt="ONDC simulated" src="https://img.shields.io/badge/ONDC-simulated-orange"></a>
</p>

<p align="center">
  <a href="https://gharsetu.dmj.one"><img alt="Try it live" src="https://img.shields.io/badge/Try%20it%20live%20%E2%86%92-gharsetu.dmj.one-0a7cff?style=for-the-badge"></a>
  &nbsp;
  <a href="https://gharsetu.dmj.one/pitch"><img alt="Capstone pitch" src="https://img.shields.io/badge/Capstone%20pitch-view%20deck-1f6feb?style=for-the-badge"></a>
</p>

---

## Table of contents

- [Why this exists](#why-this-exists)
- [Key features](#key-features)
- [Live demo](#live-demo)
- [Try it in 30 seconds](#try-it-in-30-seconds)
- [Quick start (local development)](#quick-start-local-development)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Route surface](#route-surface)
- [The verified-renter trust mechanism](#the-verified-renter-trust-mechanism)
- [ONDC integration (simulated, production-ready code)](#ondc-integration-simulated-production-ready-code)
- [Security and privacy](#security-and-privacy)
- [Accessibility (WCAG 2.2 AAA)](#accessibility-wcag-22-aaa)
- [Performance](#performance)
- [Internationalization](#internationalization)
- [Observability](#observability)
- [Deployment to Cloud Run](#deployment-to-cloud-run)
- [Project structure](#project-structure)
- [Production readiness checklist](#production-readiness-checklist)
- [Testing](#testing)
- [Roadmap](#roadmap)
- [License](#license)
- [Author and acknowledgements](#author-and-acknowledgements)
- [Citation](#citation)

---

## Why this exists

Day-scholar and out-of-town students lose weeks every semester hunting for rooms near their campus. The market is offline and fragmented: WhatsApp groups, paper notices on hostel walls, brokers who quote three different prices to three different people, and a handful of national portals that ignore tier-2 and tier-3 cities. Owners cannot reach the right students, students cannot trust unknown owners, and nobody verifies anything.

GharSetu fixes the local half of that loop. It gives a student in Solan, Mandi, or Sirmaur a fast, honest list of nearby rooms with photos, rent, rules, and reviews from people who actually lived there. It gives the owner a single place to publish once and manage requests. And it joins the national half through ONDC (Open Network for Digital Commerce), so the same listing is discoverable from any conformant buyer app in the country. Localized first. Federated by design.

---

## Key features

**For students**
- Search by city, area, landmark, college, budget, room type, gender preference, amenities.
- Map view with Leaflet and OpenStreetMap tiles, distance-from-landmark sort, list view toggle.
- Request a visit or reserve a room directly from a listing page.
- Pay rent in-platform and receive an automatic verified-renter badge.
- Leave reviews tagged Verified renter or Outsider so future students know which to trust.

**For owners**
- Publish a listing with up to six photos (resized to WebP at 1600x1200 by Sharp).
- Inbox of visit and reserve requests with one-click accept or decline.
- Mark a student as a current renter so their feedback carries the verified badge.
- Dashboard with views, requests, and current renters per listing.

**For everyone**
- Bilingual UI (English and Hindi) with cookie + Accept-Language detection.
- Server-rendered HTML, sub-200 KB pages, usable on a 2G phone.
- Installable PWA with service worker offline shell.
- WCAG 2.2 AAA accessibility from the first commit.

**For the ecosystem**
- Beckn protocol endpoints under `/ondc/v1/*` covering all nine actions plus a registry-style `/lookup`.
- DigiLocker simulated KYC flow with the exact OAuth 2.0 + PKCE shape needed for the real partner credential swap.
- Razorpay simulated order create + webhook verify with HMAC-SHA256 + timing-safe equality.
- Audit log on every mutation, queryable via the admin SIEM.

---

## Live demo

| What | Where | Notes |
|------|-------|-------|
| Custom domain | https://gharsetu.dmj.one | Primary URL, DNS propagating across regions. |
| Cloud Run service | https://gharsetu-azjqpkmlpa-de.a.run.app | Region `asia-east1`. Always reachable. |
| Inline pitch deck | https://gharsetu.dmj.one/pitch | Keyboard-navigable 16:9 slide deck. |
| Inline report | https://gharsetu.dmj.one/report | Full capstone report with sticky TOC. |
| Pitch download | https://gharsetu.dmj.one/pitch.pptx | Original `.pptx`. |
| Report download | https://gharsetu.dmj.one/report.docx | Original `.docx`. |
| Admin SIEM | https://gharsetu.dmj.one/admin | Login as `admin@gharsetu.local` / `Admin@2026!`. |
| GitHub | https://github.com/divyamohan1993/gharsetu | Source. |

The instance runs with `min-instances=0`, so the first request after a quiet period pays a one-time cold start (around five seconds). Subsequent requests warm up to sub-200ms latency. SQLite is ephemeral on Cloud Run `/tmp`, so demo data is reseeded automatically when the instance scales to zero and back.

---

## Try it in 30 seconds

1. Open <https://gharsetu.dmj.one>.
2. Click **Log in** and sign in as `student@gharsetu.local` / `Student@2026!`.
3. Open any Solan listing, click **Pay rent**, complete the simulated payment.

You will see your next review on that listing carry a **Verified renter** badge. The same badge appears if the owner marks you as a current renter from their dashboard. Anyone else who reviews without renting is tagged **Outsider** so future students can weigh the signal.

### Demo accounts (auto-seeded on first boot)

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Student | `student@gharsetu.local` | `Student@2026!` | Akshit Thakur. |
| Student | `student2@gharsetu.local` | `Student@2026!` | Priya Sharma. |
| Student | `student3@gharsetu.local` | `Student@2026!` | Rahul Singh. |
| Owner | `owner@gharsetu.local` | `Owner@2026!` | Suresh Verma. |
| Owner | `owner2@gharsetu.local` | `Owner@2026!` | Anita Kapoor. |
| Admin | `admin@gharsetu.local` | `Admin@2026!` | Super-admin SIEM access. |

---

## Quick start (local development)

Requires **Node.js 22 LTS** or newer.

```bash
git clone https://github.com/divyamohan1993/gharsetu.git
cd gharsetu
npm install
npm run dev
# open http://localhost:8080
```

The first cold start seeds a fresh SQLite DB at `/tmp/gharsetu.db` with the six demo users, ten listings across Solan, Mandi, Shimla, Chandigarh, Delhi, and Noida, sample bookings, payments, renter records, and feedback. Set `SEED_ON_START=0` to skip seeding. Delete `/tmp/gharsetu.db` (and `-wal`, `-shm` siblings) to reseed.

```bash
npm run build    # python3 scripts/render_pages.py + tsc + copy views/locales/public/schema
npm run start    # run the built dist/server.js
npm run lint     # tsc --noEmit, strict
npm test         # 10-test smoke suite, see Testing section below
```

The build step renders the capstone `.docx` and `.pptx` into HTML fragments at `src/views/_generated/report-body.ejs` and `src/views/_generated/pitch-body.ejs`, and copies the originals into `src/public/downloads/` so `/report.docx` and `/pitch.pptx` resolve. `python-docx` and `python-pptx` must be on the `PATH` for `npm run build` to succeed locally; the Dockerfile installs them inside the build stage.

---

## Architecture

```text
                                +------------------------------+
   ONDC buyer apps (BAP)  --->  |  /ondc/v1/{search,select,    |
   (Beckn protocol POSTs)       |   init,confirm,status,       |
                                |   cancel,update,rating,      |
                                |   support,lookup}            |
                                +---------------+--------------+
                                                |
   Browser  -----HTTPS----->  +-----------------v----------------+
   (slow phone, 2G ok)        |  Fastify 5  /  Node 22 LTS        |
                              |  EJS server-rendered HTML         |
                              |  zod validation, pino JSON logs   |
                              |  CSRF, rate-limit, JWT cookie     |
                              +----+--------------+----------+----+
                                   |              |          |
                       +-----------v--+   +-------v------+   +--------v--------+
                       |  SQLite      |   | /tmp/uploads |   |  /admin SSE     |
                       |  /tmp/*.db   |   | sharp -> webp|   |  audit live feed|
                       |  ephemeral   |   |  ephemeral   |   |  super-admin    |
                       +-----+--------+   +--------------+   +-----------------+
                             |
                +------------+------------+
                |    Side connectors      |
                +-------------------------+
                | Razorpay sim (HMAC)     |
                | DigiLocker sim (OAuth)  |
                | Secret Manager (JWT_*)  |
                +-------------------------+

   Single Cloud Run container, port 8080, asia-east1, min=0 max=10, 512 MiB.
```

**Why this stack**

- **Server-rendered EJS over an SPA.** A 200 KB HTML page paints on a 2G phone in under three seconds. A React bundle does not. No client framework sits in the critical path.
- **Single container, one process, no managed services.** No Redis, no queue, no managed DB for the MLP. Cloud Run scales to zero so idle cost is literally zero rupees.
- **Ephemeral SQLite.** Acceptable for a thesis MLP because the schema in `src/db/schema.sql` is portable Postgres-compatible SQL. Swap is small and documented below.

---

## Data model

Ten tables, all in `src/db/schema.sql`. ULID primary keys, epoch-millisecond timestamps, INTEGER rupees (no float), parameterized SQL only.

| Table | Purpose | Notable columns |
|-------|---------|-----------------|
| `users` | Students, owners, admins. | `role` CHECK, `kyc_verified`, `kyc_method`, sanitized `kyc_payload`, `preferred_lang`. |
| `listings` | Rooms, PGs, flats. | `property_type`, `gender_pref`, `rent_monthly`, `lat`/`lng`, `near_landmark`, `amenities` (JSON), `status`. |
| `listing_images` | Up to six WebP photos per listing. | `url` under `/uploads/...`, `position` for ordering, `ON DELETE CASCADE`. |
| `bookings` | Visit and reserve requests. | `type` (`visit`\|`reserve`), `status` (`pending`\|`accepted`\|`declined`\|`cancelled`\|`completed`), optional `ondc_order_id`. |
| `payments` | Rent payment intents and captures. | `rzp_order_id` UNIQUE, `rzp_payment_id`, `rzp_signature`, `status`, `for_month` (`YYYY-MM`). |
| `renter_records` | Source of truth for verified-renter status. | `source` (`owner_marked`\|`platform_payment`), `active`, `started_at`/`ended_at`, UNIQUE(`listing_id`,`student_id`). |
| `feedback` | Reviews on listings. | `rating` 1-5, `is_verified_renter` computed at write time from `renter_records` + captured payments. |
| `audit_log` | Every mutation and request. | `actor_id`, `action`, `entity`, `ip`, `ua`, sanitized `payload` (JSON). |
| `ondc_messages` | Beckn inbound + outbound history. | `txn_id`, `message_id`, `action`, `direction` (`in`\|`out`), `payload` (JSON). |
| `sessions` | Per-JWT revocation table. | `jti` PRIMARY KEY, `revoked`, `expires_at`. |

Indexes cover the lookups that actually run: `users(role)`, `listings(city,status)`, `listings(owner_id)`, `listings(lat,lng)`, `bookings(owner_id,status)`, `bookings(student_id,status)`, `feedback(listing_id, created_at DESC)`, `audit_log(created_at DESC)`, `audit_log(actor_id, created_at DESC)`, `ondc_messages(txn_id, created_at)`, `sessions(user_id)`.

---

## Route surface

Generated from `src/server.ts` and the route modules.

### HTML pages

| Path | Method | Purpose | Auth |
|------|--------|---------|------|
| `/` | GET | Hero + featured listings. | Public. |
| `/about` | GET | About page. | Public. |
| `/search` | GET | Filterable list/map view. | Public. |
| `/listings/:id` | GET | Listing detail with images, map, feedback. | Public. |
| `/listings/new` | GET | New listing form. | Owner. |
| `/listings` | POST | Create listing (multipart, up to 6 photos). | Owner. |
| `/listings/:id/edit` | GET | Edit form. | Owner (own). |
| `/listings/:id` | POST | Save edits. | Owner (own). |
| `/listings/:id/delete` | POST | Soft-delete (`status=removed`). | Owner (own). |
| `/listings/:id/feedback` | POST | Add review. | Authenticated. |
| `/signup` | GET, POST | Create account. | Public. |
| `/login` | GET, POST | Sign in. | Public. |
| `/logout` | POST | Revoke session and clear cookie. | Authenticated. |
| `/lang` | POST | Set the `gs_lang` cookie. | Public. |
| `/owner/dashboard` | GET | Owner inbox + listings + renters. | Owner. |
| `/owner/listings/:lid/renters` | POST | Mark a student as renter. | Owner (own). |
| `/student/dashboard` | GET | Bookings, payments, feedback. | Student. |
| `/bookings` | POST | Create visit or reserve request. | Student. |
| `/bookings/:id/decision` | POST | Owner accept / decline. | Owner (own). |
| `/verify` | GET | DigiLocker entry page. | Authenticated. |
| `/verify/digilocker/init` | POST | Start the simulated PKCE flow. | Authenticated. |
| `/verify/digilocker/callback` | GET | Exchange code, set `kyc_verified=1`. | Authenticated. |
| `/pay/:bookingId` | GET | Razorpay simulated checkout page. | Student. |
| `/admin` | GET | Super-admin SIEM dashboard. | Admin. |
| `/pitch` | GET | Inline keyboard-navigable slide deck. | Public. |
| `/report` | GET | Inline capstone report with TOC. | Public. |
| `/report.docx` | GET | 301 to the original `.docx`. | Public. |
| `/pitch.pptx` | GET | 301 to the original `.pptx`. | Public. |
| `/sw.js` | GET | Service worker at the origin root. | Public. |

### JSON APIs

| Path | Method | Purpose | Auth |
|------|--------|---------|------|
| `/api/search` | GET | JSON search results, paginated. | Public. |
| `/pay/order` | POST | Create a Razorpay order (simulated). | Student. |
| `/pay/webhook` | POST | Verify HMAC-SHA256, capture payment, create renter record. | Razorpay (signed). |
| `/admin/audit.json` | GET | Audit-log slice for SIEM polling. | Admin. |
| `/admin/audit/stream` | GET | Server-Sent Events live audit feed. | Admin. |
| `/api/healthz` | GET | Liveness probe (Knative-safe public alias). | Public. |
| `/api/readyz` | GET | Readiness probe with DB ping. | Public. |
| `/healthz` | GET | Loopback liveness for Docker `HEALTHCHECK`. | Loopback. |
| `/readyz` | GET | Loopback readiness. | Loopback. |

### ONDC (Beckn protocol simulation)

| Path | Method | Purpose |
|------|--------|---------|
| `/ondc/v1/search` | POST | ACK + async `on_search` callback with full catalog. |
| `/ondc/v1/select` | POST | ACK + async `on_select` with quote breakup. |
| `/ondc/v1/init` | POST | ACK + async `on_init` with payment terms. |
| `/ondc/v1/confirm` | POST | ACK + async `on_confirm` with order id and `state="Created"`. |
| `/ondc/v1/status` | POST | ACK + async `on_status`. |
| `/ondc/v1/cancel` | POST | ACK + async `on_cancel`. |
| `/ondc/v1/update` | POST | ACK + async `on_update`. |
| `/ondc/v1/rating` | POST | ACK + async `on_rating` with feedback form URL. |
| `/ondc/v1/support` | POST | ACK + async `on_support` with contact info. |
| `/ondc/v1/lookup` | GET | Registry-style subscriber lookup (BPP). |

> Public Cloud Run note: Knative reserves `/healthz` and `/readyz` on the public URL. Use `/api/healthz` and `/api/readyz` from outside; the bare paths are kept for the Docker `HEALTHCHECK` over loopback inside the container.

---

## The verified-renter trust mechanism

The single non-obvious idea in GharSetu. A review without context is noise. A review from someone who lived in the room is a signal.

```text
                       +-------------------------------+
                       |  Did this student rent here?  |
                       +--------------+----------------+
                                      |
              +-----------------------+----------------------+
              |                                              |
   +----------v----------+                       +-----------v-----------+
   |  owner_marked       |                       |  platform_payment     |
   |  Owner ticks the    |                       |  Successful Razorpay  |
   |  student in their   |                       |  webhook -> auto      |
   |  dashboard.         |                       |  insert into          |
   |                     |                       |  renter_records.      |
   +----------+----------+                       +-----------+-----------+
              |                                              |
              +----------------------+-----------------------+
                                     |
                       +-------------v---------------+
                       |  renter_records row exists  |
                       |  (active = 1)               |
                       +-------------+---------------+
                                     |
                       +-------------v---------------+
                       |  feedback.is_verified_renter|
                       |  is set to 1 at write time  |
                       |  (server-side, not trusted  |
                       |  from client input)         |
                       +-----------------------------+
```

There are exactly two ways a student becomes verified for a listing:

1. **Owner-marked.** From `/owner/dashboard`, the owner ticks the student as a current renter. Writes `renter_records.source = 'owner_marked'`.
2. **Platform-paid.** A Razorpay webhook with `event="payment.captured"` for an order belonging to that student and listing creates the record automatically. Writes `renter_records.source = 'platform_payment'`. Code: `src/routes/payments.ts` lines 240-282.

When a student submits a review at `POST /listings/:id/feedback`, the handler at `src/routes/feedback.ts` queries `renter_records` and captured `payments` for that pair. If either exists, the row is stored with `is_verified_renter = 1` and the listing page renders a green **Verified renter** badge (`listing.badge.verified` in `src/locales/en.json`). Otherwise the badge reads **Outsider** (`listing.badge.outsider`). The user-facing locale string makes the choice explicit before submission so nobody is surprised.

The verified flag is computed server-side from joins on `renter_records.active = 1` and `payments.status = 'captured'`. It is never read from request input. Schema: `src/db/schema.sql` lines 98-121.

---

## ONDC integration (simulated, production-ready code)

GharSetu speaks Beckn 1.2 with the RET11 / Services profile. Today the simulator runs in-process: every inbound message is logged to `ondc_messages`, the handler returns a synchronous 200 + ACK envelope, and an asynchronous `on_<action>` callback is POSTed to `context.bap_uri` on the next tick. The exact production wiring lives at the top of `src/routes/ondc.ts` inside a comment block titled `===== REAL PROD CODE (replace stub on launch) =====`. To go live, replace the simulator handlers with calls to the ONDC registry (`https://registry.ondc.org/lookup`), sign every outbound payload with Ed25519 over an SHA-512 digest, and add the ONDC-shaped `Authorization` header with `keyId="${BPP_ID}|${unique_key_id}|ed25519"`. Schema, callback model, and persistence stay identical.

Inbound envelope shape (Beckn):

```json
{
  "context": {
    "domain": "ONDC:RET11",
    "country": "IND",
    "city": "std:0792",
    "action": "search",
    "core_version": "1.2.0",
    "bap_id": "buyer.example.com",
    "bap_uri": "https://buyer.example.com/ondc/v1",
    "transaction_id": "txn_…",
    "message_id": "msg_…",
    "timestamp": "2026-05-02T12:00:00Z",
    "ttl": "PT30S"
  },
  "message": {
    "intent": {
      "category": { "id": "PG_Rental" },
      "fulfillment": {
        "end": { "location": { "gps": "30.9038,77.0930", "address": { "city": "Solan" } } }
      }
    }
  }
}
```

Synchronous response: `{ "message": { "ack": { "status": "ACK" } } }` (or `NACK` with an `error` block on a context mismatch). Async POST to `context.bap_uri/on_search` with the full catalog. Same pattern for the eight other actions. `/ondc/v1/lookup` returns a registry-style descriptor with `subscriber_id`, `subscriber_url`, `signing_public_key`, `encr_public_key`, validity window, and `status: "SUBSCRIBED"`.

### Razorpay (simulated)

`src/routes/payments.ts` carries the full real-shape implementation. `POST /pay/order` returns a Razorpay Orders API response (`id`, `entity: "order"`, `amount`, `amount_paid`, `amount_due`, `currency`, `receipt`, `status: "created"`, `notes`, `created_at`, `key_id`). `POST /pay/webhook` reads the `x-razorpay-signature` header, computes `crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex")`, and compares with `crypto.timingSafeEqual`. On `event="payment.captured"`, it updates the payment, writes an audit row, and inserts or reactivates a `renter_records` row. On `event="payment.failed"` it marks the payment failed. The `===== REAL PROD CODE =====` block at the top of the file shows the exact two-line swap to the official Node SDK.

```js
const expected = crypto.createHmac("sha256", config.RZP.WEBHOOK_SECRET).update(rawBody).digest("hex");
if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return reply.code(400).send();
```

### DigiLocker (simulated)

`src/routes/verification.ts` implements the same two-leg shape as the real DigiLocker OAuth 2.0 + PKCE flow. `POST /verify/digilocker/init` issues an audit row and 302-redirects to `/verify/digilocker/callback?code=SIM_<id>&state=<id>`. `GET /verify/digilocker/callback` validates the code prefix, writes a sanitized `kyc_payload` (last-four Aadhaar, name, year of birth only, never the full Aadhaar number), sets `users.kyc_verified=1`, audits the verification, and redirects to the appropriate dashboard. The `===== REAL PROD CODE =====` block at the top shows the production OAuth swap: SHA-256 PKCE challenge, state cookie, real `client_id`/`client_secret`, exchange against `https://api.digitallocker.gov.in/public/oauth2/1/token`, and the e-Aadhaar fetch.

---

## Security and privacy

- **Passwords:** bcrypt cost factor 12. Min length 10. Common-password rejection list.
- **Sessions:** JWT (HS256) in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie named `gs_session`. Server-side `sessions` table allows revocation on logout.
- **CSRF:** double-submit cookie via `@fastify/csrf-protection` on every state-changing POST.
- **SQL:** parameterized `better-sqlite3` prepared statements. Zero string interpolation in queries.
- **Validation:** every request body, query, and param is parsed by a `zod` schema before reaching a handler.
- **Audit log:** `audit_log` row on every mutation with actor, IP, UA, and a sanitized JSON payload. Live feed at `/admin`.
- **Rate limit:** 200 req/min/IP via `@fastify/rate-limit`. `/healthz` and `/readyz` excluded.
- **Secrets:** Google Secret Manager mounts `JWT_SECRET`, `RZP_KEY_SECRET`, `RZP_WEBHOOK_SECRET`, `DIGILOCKER_CLIENT_SECRET`, and `ADMIN_PASSWORD`. `.env` is local-only.
- **Transport:** HTTPS by default on Cloud Run with managed TLS. `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **DPDP Act 2023 + GDPR posture:** explicit consent before KYC. PII (Aadhaar, full names, phone numbers) never appears in URLs, query strings, or audit payloads. `kyc_payload` stores last-four digits only. India data stays in India: the production region is `asia-east1` (Taiwan) by default; Cloud SQL deployments should use an Indian region (`asia-south1` Mumbai or `asia-south2` Delhi).
- **Quantum-secure intent:** the production-replacement comment blocks document a migration path to ML-KEM and ML-DSA hybrid envelopes for ONDC signing once the registry supports it. Today the simulator uses Ed25519 + SHA-512 to mirror the current ONDC contract.

---

## Accessibility (WCAG 2.2 AAA)

The accessibility properties are enforced in `src/public/styles.css` and the EJS partials.

- Text contrast at or above **7:1** verified per page.
- Visible **3px outset focus ring** on every interactive element via `:focus-visible`.
- **Skip-to-main** link as the first focusable element on every page.
- ARIA landmarks (`<main>`, `<nav>`, `<header>`, `<footer>`) and `aria-label` on icon-only controls.
- Form errors associated via `aria-describedby`.
- `prefers-reduced-motion: reduce` respected (all transitions disabled).
- `forced-colors` (Windows High Contrast) respected with system colors.
- RTL-ready: `dir` attribute set per locale so future Arabic or Urdu translations need no layout changes.
- `<html lang="...">` set per request from the resolved locale.
- Pitch deck keyboard model: `Left`, `Right`, `Space`, `PgUp`, `PgDn`, `Home`, `End`, `F` (fullscreen), `Esc`.
- `aria-live="polite"` region announces slide changes to screen readers.
- Bilingual parity: every English string has a Hindi equivalent in `src/locales/hi.json`.

---

## Performance

- Server-rendered HTML; **no JS framework** in the critical path.
- Leaflet loads only on the search map view, lazily from CDN.
- Listing photos are resized to **WebP at quality 78**, max 1600x1200, by `sharp` in `src/lib/images.ts`.
- Service worker (`src/public/sw.js`) caches the app shell and the last 20 listings; an offline page renders when the network is gone.
- Single Docker image, ~631 MB, **~5s cold start**, sub-200ms warm responses on `asia-east1`.
- PWA-installable via `src/public/manifest.webmanifest`; icons at 180/192/512.
- Static assets served with `maxAge=7d` (app) and `maxAge=30d` (uploads) in production.
- SQLite runs in WAL mode with `synchronous=NORMAL` and `foreign_keys=ON`.

---

## Internationalization

Two locales live today: `en` and `hi`. Resolution order on every request (see `src/i18n.ts`):

1. `?lang=en|hi` query parameter (one-off override; also sets the cookie).
2. `gs_lang` cookie (set by `POST /lang` from the navigation toggle).
3. `Accept-Language` header.
4. `DEFAULT_LANG` env (default `en`).

To add a new locale:

1. Copy `src/locales/en.json` to `src/locales/<code>.json` and translate every key.
2. Add `<code>` to the allowed list in `src/i18n.ts`.
3. Add the option to the locale picker in `src/views/partials/nav.ejs`.
4. `npm run build && npm run start`.

The HTML is RTL-ready; the `dir` attribute is set per locale so layout does not need to change for Arabic, Urdu, or Hebrew.

---

## Observability

- **Logs:** `pino` structured JSON to stdout. Every request carries a `req.id` (ULID) and lands as a single line with method, path, status, duration, user id, IP, and UA.
- **Audit log:** `audit_log` table written on every mutation with sanitized payload. Indexed on `created_at DESC` and `(actor_id, created_at DESC)`.
- **Admin SIEM:** `/admin` renders the latest 200 audit rows plus per-table counts (users, listings, bookings, payments, feedback, active renters, ONDC messages). `/admin/audit/stream` ships a Server-Sent Events feed (`event: audit`, `event: ping`) so the dashboard stays live without polling. `/admin/audit.json` returns slices for filtered queries.
- **Health:** liveness at `/healthz` (loopback) and `/api/healthz` (public alias). Readiness at `/readyz` and `/api/readyz` runs `SELECT 1` against SQLite and returns `503` on failure. Cloud Run uses the public alias because Knative reserves `/healthz` and `/readyz` on the public URL; the Docker `HEALTHCHECK` keeps using the loopback variant.
- **Errors:** users see a friendly HTML page or the `{ error: { code, message, details } }` JSON envelope. Full stack lands in `audit_log` with the request id only.

---

## Deployment to Cloud Run

### Prerequisites

- `gcloud` authenticated against the target Google Cloud project.
- Billing enabled on the project.
- A region that hosts Cloud Run, Artifact Registry, and Secret Manager (`asia-south1` Mumbai, `asia-south2` Delhi, or `asia-east1` Taiwan).

### One command

```bash
chmod +x deploy.sh
./deploy.sh YOUR_PROJECT_ID asia-east1
# or use the asia-south1 default:
./deploy.sh YOUR_PROJECT_ID
```

`deploy.sh` is idempotent. It:

1. Verifies `gcloud` is logged in and sets the active project.
2. Enables `run`, `cloudbuild`, `artifactregistry`, and `secretmanager` APIs.
3. Creates the `gharsetu-images` Artifact Registry repository if missing.
4. Creates five Secret Manager secrets if missing: `jwt-secret`, `rzp-secret`, `rzp-webhook-secret`, `digilocker-secret`, `admin-password`. Prompts interactively; falls back to a freshly generated 96-char hex value for `JWT_SECRET` and a 64-char hex for `RZP_WEBHOOK_SECRET`.
5. Grants `roles/secretmanager.secretAccessor` on each secret to the Cloud Run runtime service account.
6. Grants the Cloud Build SA `roles/run.admin` on the project and `roles/iam.serviceAccountUser` on the runtime SA.
7. Submits `cloudbuild.yaml`, which builds the Dockerfile, pushes `:$SHORT_SHA` and `:latest` to Artifact Registry, and deploys to Cloud Run.
8. Prints the resulting service URL.

To redeploy after a code change, run `./deploy.sh YOUR_PROJECT_ID` again.

### Custom domain mapping

```bash
gcloud beta run domain-mappings create \
  --service=gharsetu \
  --domain=gharsetu.example.com \
  --region=asia-east1
```

Add the printed CNAME (or A/AAAA records) at your DNS provider. Cloud Run provisions a managed TLS certificate automatically once DNS validates.

### Current production deployment

| Setting | Value |
|---------|-------|
| Region | `asia-east1` |
| Image | `asia-east1-docker.pkg.dev/<project>/gharsetu-images/gharsetu:$SHORT_SHA` |
| Min instances | 0 |
| Max instances | 10 |
| Memory | 512 MiB |
| CPU | 1 |
| Concurrency | 80 |
| Timeout | 300 s |
| Port | 8080 |
| Env | `NODE_ENV=production`, `LOG_LEVEL=info`, `SEED_ON_START=1`, `DB_PATH=/tmp/gharsetu.db`, `UPLOADS_DIR=/tmp/uploads`, `COOKIE_SECURE=1` |
| Secrets | `JWT_SECRET=jwt-secret:latest`, `RZP_KEY_SECRET=rzp-secret:latest`, `RZP_WEBHOOK_SECRET=rzp-webhook-secret:latest`, `DIGILOCKER_CLIENT_SECRET=digilocker-secret:latest`, `ADMIN_PASSWORD=admin-password:latest` |

---

## Project structure

```text
.
├── README.md                                # this file
├── LICENSE                                  # MIT
├── SPEC.md                                  # full build specification
├── idea.md                                  # original problem statement
├── Dockerfile                               # multi-stage Node 22 + libvips + libsqlite3
├── .dockerignore
├── .gcloudignore
├── .env.example                             # documented env vars
├── cloudbuild.yaml                          # build + push + deploy steps
├── deploy.sh                                # one-shot Cloud Run deploy
├── package.json                             # engines: node>=22; ESM
├── tsconfig.json                            # strict TypeScript 5.7
├── Akshit_Thakur_Capstone_Report.docx       # source for /report
├── Akshit_Thakur_Capstone_Presentation.pptx # source for /pitch
├── scripts/
│   └── render_pages.py                      # docx/pptx -> EJS fragments + downloads
├── src/
│   ├── server.ts                            # Fastify bootstrap + global hooks
│   ├── config.ts                            # env -> typed config
│   ├── logger.ts                            # pino
│   ├── i18n.ts                              # locale resolver + t()
│   ├── auth/
│   │   ├── jwt.ts                           # issue, verify, revoke
│   │   ├── password.ts                      # bcrypt cost 12
│   │   └── middleware.ts                    # loadUser, requireAuth
│   ├── db/
│   │   ├── index.ts                         # better-sqlite3 + types + audit()
│   │   ├── schema.sql                       # 10 tables + indexes
│   │   └── seed.ts                          # 6 users, 10 listings, sample data
│   ├── lib/
│   │   ├── id.ts                            # ULID generator
│   │   ├── geo.ts                           # haversine distance
│   │   ├── images.ts                        # sharp -> WebP
│   │   ├── validate.ts                      # zod schemas
│   │   └── render.ts                        # EJS locals + flash
│   ├── locales/
│   │   ├── en.json
│   │   └── hi.json
│   ├── routes/
│   │   ├── home.ts        ondc.ts        admin.ts
│   │   ├── auth.ts        verification.ts pages.ts
│   │   ├── search.ts      payments.ts    health.ts
│   │   ├── listings.ts    feedback.ts
│   │   ├── bookings.ts    owner.ts
│   │   └── student.ts
│   ├── views/
│   │   ├── layout.ejs                       # base shell
│   │   ├── partials/                        # nav, footer, listing-card, flash
│   │   ├── _generated/                      # report-body.ejs, pitch-body.ejs
│   │   ├── home.ejs   search.ejs   listing-detail.ejs   listing-form.ejs
│   │   ├── login.ejs  signup.ejs   owner-dashboard.ejs  student-dashboard.ejs
│   │   ├── booking.ejs verify.ejs  pay.ejs              admin.ejs
│   │   ├── pitch.ejs   report.ejs  about.ejs            error.ejs
│   └── public/
│       ├── styles.css
│       ├── app.js
│       ├── search-map.js
│       ├── sw.js                            # service worker
│       ├── manifest.webmanifest             # PWA manifest
│       ├── icons/                           # 180, 192, 512 PNG
│       └── downloads/                       # generated by build: .docx, .pptx
└── tests/
    ├── README.md
    └── smoke.mjs                            # 10-test smoke suite
```

---

## Production readiness checklist

What to swap before a real launch (not the capstone demo):

| Concern | MLP today | Production swap | File reference |
|---------|-----------|-----------------|----------------|
| Database | SQLite at `/tmp/gharsetu.db` (ephemeral). | Cloud SQL for PostgreSQL. Schema is portable; replace `better-sqlite3` with `pg`; swap `INTEGER` epoch ms for `BIGINT` if needed. | `src/db/index.ts`, `src/db/schema.sql` |
| File storage | `/tmp/uploads` served by Fastify static. | Cloud Storage with V4 signed-URL uploads from the browser; CDN in front. | `src/lib/images.ts` |
| KYC | DigiLocker simulator (`code=SIM_…` callback). | Real DigiLocker partner credentials + PKCE; SHA-256 challenge; e-Aadhaar API. | `src/routes/verification.ts` (see `===== REAL PROD CODE =====` block at top) |
| Payments | Razorpay simulator (HMAC verify works against any signed payload). | Real Razorpay account; rotate `RZP_KEY_SECRET` and `RZP_WEBHOOK_SECRET`; switch to Razorpay Node SDK. | `src/routes/payments.ts` (see `===== REAL PROD CODE =====` block at top) |
| ONDC | Local Beckn simulator under `/ondc/v1/*`. | Subscribe with the ONDC Registry; generate Ed25519 + X25519 keys; sign every request per Beckn auth header spec. | `src/routes/ondc.ts` (see `===== REAL PROD CODE =====` block at top) |
| Secrets | `.env` for local dev. | Already wired to Google Secret Manager via `cloudbuild.yaml` for `JWT_SECRET`, `RZP_KEY_SECRET`, `RZP_WEBHOOK_SECRET`, `DIGILOCKER_CLIENT_SECRET`, `ADMIN_PASSWORD`. | `cloudbuild.yaml` |
| Domain + TLS | Cloud Run default `*.run.app`. | Custom domain + managed cert via `gcloud beta run domain-mappings`; set `COOKIE_SECURE=1`. | `deploy.sh` |
| Observability | pino JSON to stdout (Cloud Logging captures it automatically). | Add Cloud Logging sink to BigQuery; add Cloud Monitoring uptime check on `/api/healthz`; alert on 5xx ratio; wire Error Reporting. | `src/logger.ts` |

---

## Testing

```bash
npm test
```

Runs `node --test tests/smoke.mjs`. The runner boots `src/server.ts` via `tsx/esm` on port `8765` against a temp DB at `/tmp/gharsetu-test-<pid>.db`, polls `/healthz` for up to 60s, runs the 10 assertions below in registration order, then `SIGTERM`s the server and unlinks the DB and uploads directory.

| # | What it asserts | Endpoint |
|---|------------------|----------|
| 1 | Liveness returns `{ ok: true }`. | `GET /healthz` |
| 2 | HTML home page renders and mentions GharSetu. | `GET /` |
| 3 | Search page renders at least one Shoolini-area listing from the seed. | `GET /search` |
| 4 | JSON search returns at least one Solan listing. | `GET /api/search?city=Solan` |
| 5 | Signup + login flow issues a `gs_session` cookie. | `POST /signup`, `POST /login` |
| 6 | Authenticated student can create a visit booking with a valid CSRF token. | `POST /bookings` |
| 7 | `/pay/order` returns a Razorpay-shaped `order_id` starting with `order_`. | `POST /pay/order` |
| 8 | Beckn `/ondc/v1/search` responds with `ack.status = "ACK"`. | `POST /ondc/v1/search` |
| 9 | Admin page is gated for non-admin requests (401, 403, or redirect). | `GET /admin` |
| 10 | Liveness body shape stays `{ ok: true }`. | `GET /healthz` |

Override the port with `SMOKE_PORT=9999 npm test`. The suite exits non-zero on any failure, so wiring `npm test` as a Cloud Build step before deploy is the canonical CI integration.

See [`tests/README.md`](tests/README.md) for runner internals and how to extend the suite.

---

## Roadmap

Post-MLP work, in rough priority order:

- Real ONDC Registry subscription + Ed25519 signing on every outbound message.
- Owner WhatsApp notifications via Meta Cloud API.
- Photo verification (geo-tagged, EXIF-stripped, server-side rehosted).
- Mobile app (React Native) sharing the Beckn API surface.
- Neighbourhood chat per listing for tenant + owner conversations.
- Escrow on first month's rent.
- Cloud SQL Postgres + Cloud Storage migration.

---

## License

MIT. See [LICENSE](./LICENSE).

---

## Author and acknowledgements

**Akshit Thakur** - B.Tech CSE (Cybersecurity), Yogananda School of AI, Computers and Data Sciences, Shoolini University, Solan, Himachal Pradesh, India. Capstone defended May 2026.

Thanks to the faculty at YSACDS for project guidance, to the open-source maintainers behind Fastify, better-sqlite3, sharp, EJS, zod, pino, ulid, and bcryptjs for tools that hold their weight on a Cloud Run free tier, and to the ONDC team for documenting an open protocol that small operators can join without permission.

---

## Citation

If you reference GharSetu in academic work, please use:

```bibtex
@misc{thakur2026gharsetu,
  author       = {Akshit Thakur},
  title        = {GharSetu: Localized PG and Room Rental for University Students,
                  Federated through ONDC},
  year         = {2026},
  month        = may,
  howpublished = {B.Tech CSE (Cybersecurity) Capstone Project,
                  Yogananda School of AI, Computers and Data Sciences,
                  Shoolini University, Solan, India},
  url          = {https://gharsetu.dmj.one},
  note         = {Source: https://github.com/divyamohan1993/gharsetu}
}
```
