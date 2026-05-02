# GharSetu — Build Spec

Localized PG/room rental for university students. ONDC-connected (simulated). Cloud Run deployable. Ephemeral MLP.

**Tagline:** *Apna kamra, apne sheher mein.* (Your room, in your city.)

## Stack
- **Runtime:** Node.js 22 LTS, TypeScript 5.6 (strict)
- **HTTP:** Fastify 5
- **Templates:** EJS (server-rendered, minimal client JS)
- **DB:** SQLite via `better-sqlite3` (ephemeral file at `/tmp/gharsetu.db`, seeded on cold start)
- **Auth:** JWT (HS256) in httpOnly secure cookie + bcrypt password hashing (cost 12)
- **Maps:** Leaflet (CDN, lazy-loaded only on map pages) + OSM tiles
- **Images:** Local FS at `/tmp/uploads`, served by Fastify static; URLs `/uploads/<id>.webp`
- **Logging:** pino structured JSON
- **i18n:** English + Hindi, query/cookie selectable, RTL-ready
- **Offline:** service worker caches shell + last 20 listings
- **No build step for client:** plain CSS + vanilla JS modules
- **Tests:** node:test for unit, lightweight smoke script

## File Structure
```
/home/dmj/akshit-thakur-capstone/
├── README.md
├── Dockerfile
├── .dockerignore
├── .gcloudignore
├── package.json
├── tsconfig.json
├── cloudbuild.yaml
├── deploy.sh
├── src/
│   ├── server.ts
│   ├── config.ts
│   ├── logger.ts
│   ├── i18n.ts
│   ├── locales/
│   │   ├── en.json
│   │   └── hi.json
│   ├── db/
│   │   ├── index.ts
│   │   ├── schema.sql
│   │   └── seed.ts
│   ├── auth/
│   │   ├── jwt.ts
│   │   ├── password.ts
│   │   └── middleware.ts
│   ├── lib/
│   │   ├── id.ts            # ULID-style IDs
│   │   ├── geo.ts           # haversine
│   │   ├── images.ts        # webp resize via sharp
│   │   ├── validate.ts      # zod schemas
│   │   └── render.ts        # EJS render helper with i18n
│   ├── routes/
│   │   ├── home.ts          # /, /about
│   │   ├── auth.ts          # /signup, /login, /logout
│   │   ├── search.ts        # /search, /api/search
│   │   ├── listings.ts      # /listings/:id, /listings/new, CRUD
│   │   ├── bookings.ts      # /bookings, /api/bookings
│   │   ├── feedback.ts      # /feedback
│   │   ├── verification.ts  # /verify (DigiLocker sim)
│   │   ├── payments.ts      # /pay (Razorpay sim)
│   │   ├── ondc.ts          # /ondc/v1/* (Beckn protocol sim)
│   │   ├── owner.ts         # /owner/dashboard, mark renter
│   │   ├── student.ts       # /student/dashboard
│   │   ├── admin.ts         # /admin (super-admin SIEM)
│   │   └── health.ts        # /health, /readyz
│   ├── views/
│   │   ├── layout.ejs
│   │   ├── partials/        # nav, footer, listing-card, flash
│   │   ├── home.ejs
│   │   ├── search.ejs
│   │   ├── listing-detail.ejs
│   │   ├── listing-form.ejs
│   │   ├── login.ejs
│   │   ├── signup.ejs
│   │   ├── owner-dashboard.ejs
│   │   ├── student-dashboard.ejs
│   │   ├── booking.ejs
│   │   ├── verify.ejs
│   │   ├── pay.ejs
│   │   ├── admin.ejs
│   │   └── error.ejs
│   └── public/
│       ├── styles.css
│       ├── app.js
│       ├── search-map.js
│       ├── sw.js
│       ├── manifest.webmanifest
│       └── icons/
└── tests/
    └── smoke.mjs
```

## Data Model (SQLite)

```sql
-- users: students, owners, admins
users(
  id TEXT PRIMARY KEY,             -- ULID
  email TEXT UNIQUE NOT NULL,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','owner','admin')),
  preferred_lang TEXT DEFAULT 'en',
  kyc_verified INTEGER DEFAULT 0,  -- 0/1, set by /verify sim
  kyc_method TEXT,                 -- 'digilocker' | 'aadhaar_offline'
  kyc_payload TEXT,                -- JSON, sanitized
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- listings: rooms / PGs
listings(
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  property_type TEXT CHECK(property_type IN ('single_room','shared_room','full_pg','flat')),
  gender_pref TEXT CHECK(gender_pref IN ('male','female','any')),
  rent_monthly INTEGER NOT NULL,   -- INR paise? -> use rupees, INTEGER
  deposit INTEGER DEFAULT 0,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  near_landmark TEXT,              -- e.g., "500m from Shoolini Univ Gate 2"
  amenities TEXT NOT NULL,         -- JSON array of strings
  rules TEXT,                      -- JSON array
  available_from INTEGER NOT NULL, -- epoch
  status TEXT DEFAULT 'active' CHECK(status IN ('active','paused','rented','removed')),
  view_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

listing_images(
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,               -- /uploads/...
  position INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- bookings / visit requests
bookings(
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  owner_id TEXT NOT NULL REFERENCES users(id),
  type TEXT CHECK(type IN ('visit','reserve')) NOT NULL,
  visit_at INTEGER,                -- epoch for visit
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','declined','cancelled','completed')),
  ondc_order_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- payments (rent)
payments(
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  payer_id TEXT NOT NULL REFERENCES users(id),
  payee_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'INR',
  rzp_order_id TEXT NOT NULL,
  rzp_payment_id TEXT,
  rzp_signature TEXT,
  status TEXT DEFAULT 'created' CHECK(status IN ('created','captured','failed','refunded')),
  for_month TEXT,                  -- 'YYYY-MM'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- renter records: owner marks student as renter, OR successful payment auto-creates
renter_records(
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

-- feedback: verified or outsider
feedback(
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  is_verified_renter INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- audit log (every mutation)
audit_log(
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  ip TEXT,
  ua TEXT,
  payload TEXT,                    -- sanitized JSON
  created_at INTEGER NOT NULL
);

-- ONDC simulated transactions
ondc_messages(
  id TEXT PRIMARY KEY,
  txn_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  action TEXT NOT NULL,            -- search,on_search,select,on_select,init,on_init,confirm,on_confirm,status,on_status
  direction TEXT CHECK(direction IN ('in','out')),
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- sessions (optional: stateless JWT, but track for revocation)
sessions(
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  revoked INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

## Route Surface

### Pages (HTML, EJS)
- `GET /` — hero + search bar + featured listings (city auto-detected via `Accept-Language` & IP later; default Solan).
- `GET /search?city=&q=&min=&max=&type=&gender=&amenities=&sort=&page=` — list + map view toggle.
- `GET /listings/:id` — full detail, images, map, amenities, feedback list, contact/book CTA.
- `GET /listings/new`, `POST /listings` — owner only.
- `GET /listings/:id/edit`, `POST /listings/:id` — owner only.
- `POST /listings/:id/delete` — soft-delete (status=removed).
- `GET /signup`, `POST /signup`
- `GET /login`, `POST /login`
- `POST /logout`
- `GET /owner/dashboard` — listings, bookings inbox, mark-renter UI.
- `POST /owner/listings/:lid/renters` — mark `student_id` as renter.
- `GET /student/dashboard` — saved, bookings, payments, my feedback.
- `POST /bookings` — visit/reserve request.
- `POST /bookings/:id/decision` — owner accept/decline.
- `POST /listings/:id/feedback` — auth required; verification computed server-side.
- `GET /verify` — DigiLocker simulated flow page.
- `POST /verify/digilocker/init` — sim returns redirect URL `/verify/digilocker/callback?code=...`.
- `GET /verify/digilocker/callback` — sim exchange; sets `kyc_verified=1`.
- `GET /pay/:bookingId` — Razorpay checkout page (sim).
- `POST /pay/order` — creates `rzp_order_id` (sim).
- `POST /pay/webhook` — sim signature verify, marks captured, creates renter_record.
- `GET /admin` — super-admin SIEM dashboard (auto-refresh, filterable audit log).

### APIs (JSON)
- `GET /api/search` — JSON of search results.
- `GET /api/listings/:id`
- `POST /api/bookings`
- `GET /healthz`, `GET /readyz`

### ONDC (Beckn protocol simulation)
All under `/ondc/v1/`:
- `POST /ondc/v1/search` — receives Beckn search; responds 202 then async POSTs `on_search` to `context.bap_uri`.
- `POST /ondc/v1/select`, `/init`, `/confirm`, `/status`, `/cancel`, `/update`, `/rating`, `/support`
- All payloads logged in `ondc_messages`.
- Schema follows Beckn protocol v1.1 with retail/services profile; document the divergence in code comments.

## Auth Conventions
- Cookie name: `gs_session`. `Path=/`, `HttpOnly`, `Secure`, `SameSite=Lax`, max-age 7 days.
- JWT claims: `{sub, role, jti, iat, exp}`. Secret from `JWT_SECRET` env, fallback random per process (logged with WARN).
- CSRF: double-submit cookie `gs_csrf` for POST forms.
- Password rules: min 10 chars; no list of common.

## Error Shape
JSON: `{"error":{"code":"<UPPER_SNAKE>","message":"<safe>","details":{...}}}`.
HTML: render `error.ejs` with friendly message + correlation ID.

## Logging
Every request: `req.id` (ULID), method, path, status, ms, user_id, ip, ua.
Every mutation: `audit_log` row.
User errors → friendly HTML; full stack in audit_log only.

## Env Vars
```
PORT=8080
NODE_ENV=production
JWT_SECRET=<256-bit hex>
DB_PATH=/tmp/gharsetu.db
UPLOADS_DIR=/tmp/uploads
SEED_ON_START=1
ONDC_BAP_URI=https://gharsetu.example/ondc/v1
ONDC_BAP_ID=gharsetu.example
RZP_KEY_ID=rzp_test_simulated
RZP_KEY_SECRET=simulated_secret_xxxxx
DIGILOCKER_CLIENT_ID=simulated_client
DIGILOCKER_CLIENT_SECRET=simulated_secret
DIGILOCKER_REDIRECT_URI=https://gharsetu.example/verify/digilocker/callback
LOG_LEVEL=info
ADMIN_EMAIL=admin@gharsetu.local
ADMIN_PASSWORD=ChangeMe!2026
```

## Cloud Run
- Single container, port 8080.
- `min-instances=0`, `max-instances=10`, `memory=512Mi`, `cpu=1`, `concurrency=80`.
- Ephemeral DB on `/tmp` — user must accept that data resets when instance scales to zero. **Document this prominently.**
- Build via `gcloud run deploy --source .` (Buildpacks) or Dockerfile.

## WCAG 2.2 AAA
- Contrast ≥ 7:1 for text.
- All interactive: keyboard reachable, visible focus ring (3:1), `:focus-visible`.
- Skip-to-content link.
- ARIA labels on icon buttons.
- prefers-reduced-motion respected.
- Form errors associated via `aria-describedby`.
- Lang attribute set per request.

## Conventions
- ULID for IDs (collision-free, sortable).
- All timestamps: epoch ms (INTEGER).
- Money: INTEGER rupees (no float).
- Validation at every boundary via zod.
- No `any` in TS code.
- File header: none (no comment noise).
