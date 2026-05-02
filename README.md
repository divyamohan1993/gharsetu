# GharSetu

**Apna kamra, apne sheher mein.** *(Your room, in your city.)*

Localized PG and room rental for university students, federated through ONDC. Built to work on a slow phone, a flaky 2G connection, and a small-town budget.

---

## The problem

Day-scholar and out-of-town students lose weeks every semester hunting for rooms near their campus. The market is offline, fragmented across WhatsApp groups, paper notices on hostel walls, and a few national portals that ignore tier-2 and tier-3 cities. Owners can't reach students; students can't trust owners; nobody verifies anything.

GharSetu fixes the local half of that loop and joins the national half through **ONDC** (Open Network for Digital Commerce), so a student searching from any ONDC buyer-app can discover a verified room near their university, and an owner who lists once is visible everywhere.

---

## Live demo

> **TBD** — paste the Cloud Run URL after first deploy.

---

## Quick start (local)

```bash
npm install
npm run dev
# open http://localhost:8080
```

The first cold start seeds a fresh SQLite DB at `/tmp/gharsetu.db` with demo data and three accounts:

| Role    | Email                      | Password        |
|---------|----------------------------|-----------------|
| Student | `student@gharsetu.local`   | `Student@2026`  |
| Owner   | `owner@gharsetu.local`     | `Owner@2026`    |
| Admin   | `admin@gharsetu.local`     | `Admin@2026`    |

Set `SEED_ON_START=0` to skip seeding. Delete `/tmp/gharsetu.db` to re-seed.

---

## Architecture

```
                       +-------------------------+
   ONDC buyer apps --->| /ondc/v1/* (Beckn sim)  |
                       +-------------+-----------+
                                     |
   Browser  ----HTTP/2/TLS--->  +----v---------------------+
   (mobile)                     |  Fastify 5  (Node 22)    |
                                |  EJS SSR + minimal JS    |
                                |  zod validation          |
                                |  pino structured logs    |
                                +----+---------------+-----+
                                     |               |
                          +----------v----+   +------v-----------+
                          |  SQLite       |   |  /tmp/uploads    |
                          |  /tmp/*.db    |   |  (sharp -> webp) |
                          | (ephemeral)   |   |  (ephemeral)     |
                          +---------------+   +------------------+

       Single Cloud Run container, port 8080, min=0 max=10, 512 MiB.
```

- **Server-rendered EJS** keeps first paint instant on a slow phone — no JS bundle to download before the page is usable.
- **SQLite + local FS** is intentional for the MLP: zero infra cost, zero ops. The path to Cloud SQL + Cloud Storage is documented below.
- **Single container** on Cloud Run. Cold-start fast because the DB is built in-memory from `schema.sql` + seed on boot.
- **ONDC simulated** under `/ondc/v1/*` against the Beckn protocol v1.1 retail/services profile. Real subscriber registration is a swap-in, not a rewrite.
- **DigiLocker simulated** for KYC — the OAuth2 PKCE flow is wired; only the upstream `client_id` / `client_secret` need to change.
- **Razorpay simulated** for rent payments — order create + webhook signature verify are real-shape; switch keys to go live.

---

## Why this stack

- **SSR over SPA.** A 200 KB EJS page renders on a 2G phone in under 3 seconds. A React bundle does not.
- **One container, one process.** No Redis, no queue, no managed DB for the MLP. Cloud Run scales to zero — idle cost is literally zero rupees.
- **Ephemeral SQLite.** Acceptable for a thesis MLP. The data model is portable Postgres-compatible SQL; the swap is small, documented below.

---

## Production checklist

What to swap before a real launch (not for the capstone demo):

| Concern                | MLP today                                     | Production                                                                 |
|------------------------|-----------------------------------------------|----------------------------------------------------------------------------|
| **Database**           | SQLite at `/tmp/gharsetu.db` (ephemeral)      | Cloud SQL for PostgreSQL. Schema in `src/db/schema.sql` is portable; replace `better-sqlite3` with `pg`. Set `DB_PATH` to the Cloud SQL Unix socket. |
| **File storage**       | `/tmp/uploads` served by Fastify static       | Cloud Storage with V4 signed-URL uploads from the browser; CDN in front.   |
| **KYC**                | Simulated DigiLocker OAuth2                   | Real DigiLocker partner credentials + PKCE flow — see the `// REAL CODE` block in `src/routes/verification.ts`. |
| **Payments**           | Simulated Razorpay order + webhook            | Real Razorpay account; rotate `RZP_KEY_SECRET` + `RZP_WEBHOOK_SECRET`; see the `// REAL CODE` block in `src/routes/payments.ts`. |
| **ONDC**               | Local Beckn simulator under `/ondc/v1/*`      | Register as a subscriber with the ONDC registry, generate Ed25519 + X25519 key pairs, configure gateway URL, wire request signing per Beckn auth header spec. |
| **Secrets**            | `.env` for local dev                          | Already wired to Google Secret Manager via `cloudbuild.yaml` — `JWT_SECRET`, `RZP_KEY_SECRET`, `RZP_WEBHOOK_SECRET`, `DIGILOCKER_CLIENT_SECRET`, `ADMIN_PASSWORD`. |
| **Domain + TLS**       | Cloud Run default `*.run.app`                 | Custom domain + managed cert via Cloud Run domain mapping; set `COOKIE_SECURE=1`. |
| **Observability**      | pino JSON to stdout                           | Cloud Logging is automatic. Add Cloud Monitoring uptime check on `/healthz` and an alert policy on 5xx ratio. |

---

## Deploying to Cloud Run

```bash
chmod +x deploy.sh
./deploy.sh YOUR_PROJECT_ID            # uses asia-south1 + service "gharsetu"
# or
./deploy.sh YOUR_PROJECT_ID asia-south1 gharsetu
```

`deploy.sh` is fully idempotent. It will:

1. Verify `gcloud` is logged in and set the active project.
2. Enable `run`, `cloudbuild`, `artifactregistry`, `secretmanager` APIs.
3. Create the `gharsetu-images` Artifact Registry repo if missing.
4. Create five Secret Manager secrets if missing — `jwt-secret`, `rzp-secret`, `rzp-webhook-secret`, `digilocker-secret`, `admin-password`. Prompts interactively; falls back to a freshly generated 96-char hex value for `JWT_SECRET` and a 64-char hex for `RZP_WEBHOOK_SECRET`.
5. Grant `roles/secretmanager.secretAccessor` to the Cloud Run runtime SA on each secret.
6. Grant the Cloud Build SA `roles/run.admin` on the project and `roles/iam.serviceAccountUser` on the runtime SA.
7. Submit `cloudbuild.yaml`, which builds the Dockerfile, pushes `:$SHORT_SHA` and `:latest` to Artifact Registry, and deploys to Cloud Run.
8. Print the resulting service URL.

To re-deploy after a code change, just run `./deploy.sh YOUR_PROJECT_ID` again.

---

## ONDC integration

GharSetu speaks the Beckn protocol (which ONDC is built on) at version **1.1** with the **retail/services** profile. Today the simulator runs in-process — every inbound message is logged to `ondc_messages` and an `on_*` reply is dispatched asynchronously to `context.bap_uri`. Real ONDC integration requires registering as a subscriber and signing every request with the registry-issued Ed25519 keys; everything else stays the same.

The nine simulated endpoints, all under `/ondc/v1/`:

| Endpoint     | Direction      | Purpose                                                |
|--------------|----------------|--------------------------------------------------------|
| `/search`    | inbound (BPP)  | discover listings matching a buyer query               |
| `/select`    | inbound (BPP)  | select a specific listing                              |
| `/init`      | inbound (BPP)  | initialize a booking with billing details              |
| `/confirm`   | inbound (BPP)  | confirm the booking                                    |
| `/status`    | inbound (BPP)  | check the order status                                 |
| `/cancel`    | inbound (BPP)  | cancel an order                                        |
| `/update`    | inbound (BPP)  | update order metadata                                  |
| `/rating`    | inbound (BPP)  | rate the seller after a transaction                    |
| `/support`   | inbound (BPP)  | request support contact                                |

ONDC docs: <https://ondc.org/> · Beckn protocol: <https://github.com/beckn/protocol-specifications>

---

## Accessibility

Target: **WCAG 2.2 AAA**. Specifically:

- Text contrast **>= 7:1** verified per page.
- Every interactive element is keyboard-reachable; visible focus ring **>= 3:1** via `:focus-visible`.
- Skip-to-content link as the first focusable element on every page.
- ARIA labels on icon-only buttons. Form errors associated via `aria-describedby`.
- `prefers-reduced-motion: reduce` respected — all transitions disabled.
- `<html lang="...">` set per request from the user's preferred language.
- Tested with NVDA on Firefox and VoiceOver on Safari.

---

## Security

- **Passwords:** bcrypt cost factor 12. Min length 10. Common-password list rejected.
- **Sessions:** JWT (HS256), short-lived (7 days), in `httpOnly` `Secure` `SameSite=Lax` cookie. Server-side `sessions` table allows revocation.
- **CSRF:** double-submit cookie (`gs_csrf`) verified on every state-changing POST. Wired via `@fastify/csrf-protection`.
- **Rate limiting:** `@fastify/rate-limit` — 200 req / minute / IP by default; `/healthz` and `/readyz` excluded.
- **Audit log:** every mutation writes to `audit_log` with actor, IP, UA, sanitized payload — visible in `/admin`.
- **No secrets in code or logs.** All sensitive values come from env (Secret Manager in prod). PII is never logged or put into URLs.
- **SQL:** parameterized via `better-sqlite3` prepared statements. Zero string interpolation.
- **Validation:** every request body, query, and param is parsed by a `zod` schema before reaching a handler.
- **Headers:** `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin` set globally.

---

## i18n

Bilingual at launch — **English + Hindi** — with the locale picker living in the navigation bar. Locale resolution order on every request:

1. `?lang=hi` query param (one-off override + sets cookie).
2. `gs_lang` cookie.
3. `Accept-Language` header.
4. `DEFAULT_LANG` env (default `en`).

Strings live in `src/locales/en.json` and `src/locales/hi.json`. **To add a language:**

1. Copy `en.json` to `src/locales/<code>.json` and translate.
2. Add the code to the allowed list in `src/i18n.ts`.
3. Add the option to the locale picker in `src/views/partials/nav.ejs`.

The HTML is RTL-ready — the `dir` attribute is set per locale so a future Arabic or Urdu translation needs no layout changes.

---

## Tests

```bash
npm test
```

Runs the smoke suite in `tests/smoke.mjs`. Every prod bug becomes a regression test here.

```bash
npm run lint     # tsc --noEmit, strict
npm run build    # transpile + copy views/locales/public/schema
npm run start    # run the built dist
```

---

## Project structure

```
.
├── README.md
├── LICENSE
├── Dockerfile
├── .dockerignore
├── .gcloudignore
├── .gitignore
├── .env.example
├── cloudbuild.yaml
├── deploy.sh
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts          # Fastify bootstrap + global middleware
│   ├── config.ts          # env -> typed config
│   ├── logger.ts          # pino
│   ├── i18n.ts            # locale resolver + t()
│   ├── locales/           # en.json, hi.json
│   ├── db/                # better-sqlite3 + schema.sql + seed.ts
│   ├── auth/              # jwt, password (bcrypt), middleware
│   ├── lib/               # id, geo, images (sharp), validate (zod), render
│   ├── routes/            # one file per feature surface
│   ├── views/             # EJS templates + partials
│   └── public/            # static CSS/JS, service worker, icons
└── tests/
    └── smoke.mjs
```

---

## License

MIT — see [LICENSE](./LICENSE).

## Author

**Akshit Thakur** — B.Tech CSE (Cybersecurity) · Capstone 2026.
Built end-to-end as a final-year capstone to demonstrate ONDC-native local commerce on a budget that an actual student can afford.
