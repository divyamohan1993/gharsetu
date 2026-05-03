# Changelog

All notable changes to GharSetu will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- TBD

### Changed
- TBD

### Fixed
- TBD

### Security
- TBD

### Removed
- TBD

## [0.1.0] — 2026-05-03

First public release. MLP for the GharSetu localized PG and room rental platform with ONDC connectivity.

### Added
- Server-rendered Fastify 5 + EJS application with a 10-table SQLite schema (`users`, `listings`, `listing_images`, `bookings`, `payments`, `renter_records`, `feedback`, `audit_log`, `ondc_messages`, `sessions`).
- Listings CRUD with up to six images per listing, resized to WebP at quality 78 via Sharp.
- Search with text query, city, price range, type, gender, amenities, and sort; geographic distance via Haversine when `near_lat` / `near_lng` are provided.
- Bookings: visit and reserve flows; owner accept / decline; cancel.
- Verified-renter badge derived from owner attestation OR successful platform payment.
- Razorpay payment simulation with HMAC SHA256 webhook signature verification.
- DigiLocker KYC OAuth simulation (sanitised payload stored against `users`).
- ONDC Beckn protocol simulation: nine retail-services actions (`search`, `select`, `init`, `confirm`, `status`, `cancel`, `update`, `rating`, `support`) plus `/ondc/v1/lookup`. Synchronous ACK + asynchronous `on_<action>` callback pattern. Every payload logged to `ondc_messages`.
- English and Hindi UI with cookie + `Accept-Language` detection, RTL-ready CSS.
- WCAG 2.2 AAA design system: contrast ≥ 7:1, visible 3 px focus ring, skip-to-main link, ARIA landmarks per page, `prefers-reduced-motion` and `forced-colors` respected, keyboard parity across the whole surface.
- Service worker shell cache with offline page; PWA-installable via `manifest.webmanifest`.
- `/report` route renders the capstone report inline with TOC sidebar; `/report.docx` redirects to the downloadable Word file.
- `/pitch` route renders the capstone presentation as a 22-slide keyboard-navigable deck (← → space PgUp PgDn Home End F Esc); `/pitch.pptx` redirects to the downloadable PowerPoint file.
- `/admin` SIEM page with live SSE feed of `audit_log`, queryable by entity / action.
- `/api/healthz` and `/api/readyz` aliases (Knative reserves `/healthz` on the public URL; the canonical paths still work over loopback for the Docker `HEALTHCHECK`).
- 10-test smoke suite (`tests/smoke.mjs`) covering health, browse, auth, booking, payment, ONDC, admin block.
- Multi-stage Dockerfile (~631 MB) with libvips + libsqlite3 in the runtime, `tini` as PID 1, non-root `node` user, container `HEALTHCHECK`.
- Cloud Build pipeline (`cloudbuild.yaml`) and `deploy.sh` covering Artifact Registry repo creation, secret provisioning in Secret Manager, IAM grant for the runtime service account, build, and deploy.
- Custom domain mapping at <https://gharsetu.dmj.one> served from Cloud Run `asia-east1`.

### Security
- bcrypt cost 12 password hashing.
- JWT HS256 in `HttpOnly Secure SameSite=Lax` cookie with a `sessions` table for revocation.
- CSRF double-submit token (`@fastify/csrf-protection`) on every state-changing POST.
- Parameterised SQL only (`better-sqlite3` prepared statements).
- `audit_log` row on every mutation, exposed via `/admin`.
- Rate limit 200 req / minute / IP (`@fastify/rate-limit`), `/api/healthz` and `/api/readyz` allow-listed.
- `JWT_SECRET` mounted from Google Secret Manager; no secrets in code, logs, or URLs.
- HTTPS by default on Cloud Run; HSTS, X-Content-Type-Options, Referrer-Policy applied at the edge.

[Unreleased]: https://github.com/divyamohan1993/gharsetu/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/divyamohan1993/gharsetu/releases/tag/v0.1.0
