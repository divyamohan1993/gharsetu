# Smoke tests

End-to-end smoke suite that boots the real Fastify server against a throwaway SQLite file and exercises the public surface from health probes through ONDC. Every prod bug should land here as a regression test before being closed.

## Run

```bash
npm test
```

That runs `node --test tests/smoke.mjs`. The runner uses `tsx/esm` to import the TypeScript source directly, so you do not need `npm run build` first. If you want to test the compiled artefact instead, run `npm run build && node --test tests/smoke.mjs` with `SMOKE_USE_DIST=1` after pointing the spawn line at `dist/server.js`.

## What it does

- Boots `src/server.ts` via `node --import tsx/esm` on `127.0.0.1:8765`.
- Seeds a fresh SQLite DB at `/tmp/gharsetu-test-<pid>.db` and an uploads dir at `/tmp/gharsetu-test-uploads-<pid>`.
- Sets `SEED_ON_START=1`, `COOKIE_SECURE=0`, `NODE_ENV=test`, `JWT_SECRET=test_secret_at_least_32_chars_xxxx`, `RATE_LIMIT_MAX=10000`, `LOG_LEVEL=warn`.
- Polls `GET /healthz` for up to 60 s before any assertions run.
- Runs the 10 checks below in registration order.
- Sends `SIGTERM` to the server; falls back to `SIGKILL` after 3 s if the process is still alive.
- Unlinks the temp DB (plus `-wal` and `-shm` siblings) and removes the uploads directory.

## The 10 checks

| # | Endpoint | Asserts |
|---|----------|---------|
| 1 | `GET /healthz` | `200` and `{ ok: true }`. |
| 2 | `GET /` | `200`, body contains `<html` and `GharSetu`. |
| 3 | `GET /search` | `200`, body mentions Shoolini (proves seed listings rendered). |
| 4 | `GET /api/search?city=Solan` | `200`, `data` is a non-empty array. |
| 5 | `POST /signup` then `POST /login` | Status in `{200,302,303}`; second response sets a `gs_session` cookie. |
| 6 | `POST /bookings` | Authenticated student creates a `visit` booking; status `< 400`. CSRF token re-read from `/listings/:id`. |
| 7 | `POST /pay/order` | `200`; response `order_id` (or `data.order_id` / `id`) starts with `order_`. |
| 8 | `POST /ondc/v1/search` | `200`; `body.message.ack.status === "ACK"`. Sends a Beckn 1.1 envelope with `domain="ONDC:RET11"`, `city="std:0792"`. |
| 9 | `GET /admin` (no admin cookie) | `401`, `403`, `302`, or `303`. |
| 10 | `GET /healthz` | Same as #1, run again at the end as a regression sentinel. |

## Override port

```bash
SMOKE_PORT=9999 npm test
```

## Adding a test

Append to `tests/smoke.mjs` (or split into modules under `tests/` and import them from the entry file). Use the existing helpers:

- `new CookieJar()`: collects `Set-Cookie` headers and replays them on subsequent requests; supports `getSetCookie()` and falls back to single-header reads.
- `http(path, opts, jar)`: `fetch` wrapper that injects the jar's cookie header and ingests the response's `Set-Cookie`. `redirect: "manual"` so 302s are observable.
- `getCsrf(path, jar)`: fetches an HTML page and extracts the `_csrf` hidden input. Required for any state-changing form POST.
- `postForm(path, data, jar)` and `postJson(path, data, jar)`: form-encoded and JSON shorthands.

`node:test` runs tests in registration order, so any test that depends on a previous one (a logged-in cookie jar, a freshly-seeded listing) should be defined after it. Keep cleanup idempotent: the global `after()` hook only kills the server and removes the temp files; nothing inside an individual test should mutate global fixtures.

## Running against production

The runner boots its own server, so `npm test` cannot point at `https://gharsetu.dmj.one` directly today. To smoke-test a remote deployment, fork `tests/smoke.mjs` into `tests/prod-smoke.mjs`, drop the `before` / `after` server lifecycle, and read the base URL from `process.env.BASE`:

```bash
BASE=https://gharsetu.dmj.one node --test tests/prod-smoke.mjs
```

Skip the signup, booking, and pay tests in the prod variant unless you have a dedicated test tenant; the seeded `student@gharsetu.local` account on the live demo is shared.

## CI integration

`npm test` exits non-zero on any failure. Wire it into Cloud Build by adding a step before `deploy`:

```yaml
- id: test
  name: node:22-bookworm-slim
  entrypoint: bash
  args: ['-c', 'apt-get update && apt-get install -y --no-install-recommends python3 python3-pip make g++ pkg-config libvips-dev libsqlite3-dev && npm ci && npm test']
  waitFor: ['-']
```

Set `waitFor` on the existing `build` step to `['test']` so the image is only built when the suite passes.
