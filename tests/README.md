# GharSetu smoke tests

End-to-end smoke suite that boots the real Fastify server against a throwaway SQLite file in `/tmp` and exercises the public surface.

## Run

```bash
npm test
```

That runs `node --test tests/smoke.mjs`. The script:

1. Spawns `node --import tsx/esm src/server.ts` on port `8765` with these env overrides:
   - `DB_PATH=/tmp/gharsetu-test-<pid>.db`
   - `UPLOADS_DIR=/tmp/gharsetu-test-uploads-<pid>`
   - `SEED_ON_START=1`, `COOKIE_SECURE=0`, `NODE_ENV=test`
   - `JWT_SECRET=test_secret_at_least_32_chars_xxxx`
   - `RATE_LIMIT_MAX=10000` (so the suite never trips rate limiting)
2. Polls `GET /healthz` for up to 60s before any assertions run.
3. Runs the assertions (health, home, search HTML + JSON, signup/login flow, booking, payment order, ONDC `/search` ACK, admin gate).
4. Kills the server and removes the temp DB and uploads directory.

## Override port

```bash
SMOKE_PORT=9999 npm test
```

## Notes

- Tests rely on the seed data, which is created automatically because the spawned server sees an empty DB.
- The seed is idempotent: if the DB already has users it exits early, so repeat runs against a persistent DB are safe.
- Every CSRF-protected `POST` reads a fresh `_csrf` token from the matching `GET` page using the same cookie jar.
