# Contributing to GharSetu

Thank you for considering a contribution. GharSetu is a small, opinionated project that ships to a real Cloud Run deployment and is read by reviewers, recruiters, and other students. Pull requests are welcome and the bar is high: every change must keep the build green, the smoke suite green, accessibility at WCAG 2.2 AAA, and bilingual parity (English plus Hindi) intact.

This document explains how to ask questions, file bugs, propose features, set up a local environment, write code that fits the codebase, and get your patch merged.

## Code of conduct

Participation is governed by the [Contributor Covenant v2.1](./CODE_OF_CONDUCT.md). Report unacceptable behaviour to `conduct@dmj.one`. The maintainer team will respond within 72 hours.

## How to ask a question

Open a thread in [GitHub Discussions](https://github.com/divyamohan1993/gharsetu/discussions). Issues are reserved for confirmed bugs and concrete feature proposals. A question turned into an Issue will be moved to Discussions and closed.

Before posting, search existing Discussions and the [README](./README.md) (the section table of contents covers most setup, deployment, and architecture questions).

## How to report a bug

1. Reproduce the bug against the latest `master` commit.
2. Confirm it is not already filed by searching open and closed Issues.
3. Open a new Issue using the [bug report template](./.github/ISSUE_TEMPLATE/bug_report.yml).

A useful bug report includes the affected commit hash, browser and operating system, the route or page, the exact steps to reproduce, the expected behaviour, the actual behaviour, and any relevant log lines or screenshots. If a network call is involved, paste the `req.id` from the response body or from the `/admin` SIEM page.

For security vulnerabilities do not open a public Issue. Follow [SECURITY.md](./SECURITY.md) instead.

## How to request a feature

Open a Feature Request using the [feature request template](./.github/ISSUE_TEMPLATE/feature_request.yml). A useful proposal explains the problem first, the proposed solution second, and the alternatives considered third.

A proposal is more likely to be accepted when it:

- Improves the experience for the primary user (a day-scholar or out-of-town student in a tier-2 or tier-3 city, often on a slow phone).
- Keeps the page weight under 200 KB and the cold start under five seconds.
- Maintains WCAG 2.2 AAA contrast and keyboard support.
- Adds a Hindi translation alongside any new English string.
- Does not break the production route surface documented in [SPEC.md section 7](./SPEC.md).

A proposal that requires a new third-party dependency, a new managed service, or a schema migration must justify the cost in the proposal body.

## Local development setup

Requires Node.js 22 LTS or newer and Python 3 with `python-docx` and `python-pptx` available on `PATH` (the build step renders the capstone report and pitch deck into HTML fragments).

```bash
git clone https://github.com/divyamohan1993/gharsetu.git
cd gharsetu
nvm use            # or otherwise switch to Node 22
npm install
npm run dev
```

Open `http://localhost:8080`. The first cold start seeds a fresh SQLite DB at `/tmp/gharsetu.db` with the demo accounts, ten listings across Solan, Mandi, Shimla, Chandigarh, Delhi, and Noida, sample bookings, payments, renter records, and feedback. Set `SEED_ON_START=0` to skip seeding. Delete `/tmp/gharsetu.db` (and the `-wal`, `-shm` siblings) to reseed.

### Demo accounts

| Role    | Email                        | Password         |
| ------- | ---------------------------- | ---------------- |
| Student | `student@gharsetu.local`     | `Student@2026!`  |
| Student | `student2@gharsetu.local`    | `Student@2026!`  |
| Student | `student3@gharsetu.local`    | `Student@2026!`  |
| Owner   | `owner@gharsetu.local`       | `Owner@2026!`    |
| Owner   | `owner2@gharsetu.local`      | `Owner@2026!`    |
| Admin   | `admin@gharsetu.local`       | `Admin@2026!`    |

### Useful scripts

```bash
npm run build    # render docx/pptx, compile TypeScript, copy assets
npm run start    # run the built dist/server.js
npm run lint     # tsc --noEmit, strict
npm test         # 10-test smoke suite, see Testing below
```

## Project structure

A short tree of `src/` is below; the full annotated layout lives in the [Project structure](./README.md#project-structure) section of the README.

```text
src/
  server.ts        # Fastify bootstrap and global hooks
  config.ts        # env -> typed config
  i18n.ts          # locale resolver and t()
  auth/            # jwt, password, middleware
  db/              # better-sqlite3 wrapper, schema.sql, seed
  lib/             # id, geo, images, validate, render
  routes/          # one file per route group (home, search, listings, ...)
  views/           # EJS templates and partials
  locales/         # en.json, hi.json
  public/          # styles, app.js, sw.js, manifest, icons
```

## Development workflow

### Branch naming

Branch off `master`. Use a short, kebab-case slug after the type prefix:

- `feat/<short-slug>` for new functionality
- `fix/<short-slug>` for bug fixes
- `docs/<short-slug>` for documentation
- `chore/<short-slug>` for tooling, dependencies, or build changes
- `refactor/<short-slug>` for non-behavioural code changes
- `test/<short-slug>` for tests only
- `ci/<short-slug>` for CI configuration changes

### Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <summary>

<body explains the why>

Closes #<issue>
```

Allowed types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `chore`, `ci`, `revert`. The scope is a short noun matching a route group, a module, or an area: `auth`, `listings`, `bookings`, `payments`, `ondc`, `verification`, `admin`, `i18n`, `views`, `db`, `deploy`, `tests`. The summary is a present-tense imperative under 72 characters with no trailing period.

Examples:

```
feat(listings): add gender-pref filter to /search
fix(payments): reject webhook with mismatched body length
docs(readme): correct Cloud Run min-instances note
```

The body explains motivation, trade-offs, and any user-visible behaviour change. Reference Issues with `Closes #<n>` or `Refs #<n>`.

### Pre-commit checklist

Before pushing:

```bash
npm run lint     # must pass
npm test         # must pass (10/10)
npm run build    # must succeed
```

CI re-runs all three on every push and pull request. A red CI is a blocker.

## Coding standards

### TypeScript

- TypeScript runs in `strict` mode (see `tsconfig.json`). Do not relax it.
- Avoid `any`. If you genuinely need `unknown`, use `unknown` and narrow at the use site.
- Do not add `// @ts-ignore` or `// @ts-expect-error` without an inline reason and an upstream link or issue number.
- Imports use the existing path style: relative paths within `src/`, no `paths` aliases.

### Server-rendered first

GharSetu renders HTML on the server with EJS. Adding client-side JavaScript is a deliberate decision, not a default. If a feature can be expressed with a `<form>` POST and a server response, prefer that. Client JS should be small, framework-free, and lazy-loaded (see `src/views/search.ejs` for the Leaflet pattern).

### Accessibility

- Every interactive element has a visible `:focus-visible` outline (handled in `src/public/styles.css`; do not override it).
- Body text must contrast at 7:1 or better against its background. Run a spot check with any contrast tool before opening a PR.
- Icon-only controls require an `aria-label`.
- Forms attach validation errors via `aria-describedby` and announce via the `role="alert"` flash region.
- Honour `prefers-reduced-motion: reduce` and `forced-colors: active`.
- `<html lang>` is set per request from the resolved locale; do not hardcode `lang`.

### Internationalisation

Every user-facing string goes through `t()` (see `src/i18n.ts`). When you add or rename a key:

1. Add the key to `src/locales/en.json`.
2. Add the same key to `src/locales/hi.json` with a Hindi translation. Do not commit a placeholder; native or near-native quality is required.
3. Reference the key in templates with `<%= t(locale, 'your.key') %>`.

A PR that adds an English-only string will not be merged.

### Auditing mutations

Every state-changing handler must call `audit({ ... })` (see `src/db/index.ts`) with the actor, action, entity, and a sanitised payload. Examples live in `src/routes/listings.ts`, `src/routes/bookings.ts`, and `src/routes/payments.ts`. Do not log full request bodies; redact secrets, full names, full Aadhaar, full phone numbers, and signatures (the `pino` redactor in `src/logger.ts` lists the redacted paths).

### Validation and SQL

- Every request body, query, and param is parsed by a `zod` schema in `src/lib/validate.ts` before reaching the handler.
- All SQL is parameterised through `better-sqlite3` prepared statements. String interpolation in SQL is a hard reject.

### CSRF

Every state-changing POST submitted from a browser form includes a `_csrf` hidden input wired up by the EJS layout. Do not bypass `@fastify/csrf-protection`. The signed-webhook endpoint at `POST /pay/webhook` is the only legitimate exception and is documented in `src/routes/payments.ts`.

## Testing

```bash
npm test
```

Runs the 10-test smoke suite at `tests/smoke.mjs`. The runner boots `src/server.ts` via `tsx/esm` on a temporary port, polls `/healthz` for up to 60 seconds, runs the assertions in registration order, then `SIGTERM`s the server and unlinks the test DB and uploads directory. See [`tests/README.md`](./tests/README.md) for the runner internals.

Two rules:

1. Every production bug must land as a regression test before the fix is merged. Add a new function in `tests/smoke.mjs` (or a new module under `tests/` if the area warrants it).
2. New routes need a smoke assertion that proves the success path returns the documented shape and that the failure path returns a sane status code. Public JSON endpoints get a JSON shape check; HTML pages get a `text/html` content-type check plus a presence check on a known string.

## Pull request process

1. Open the PR against `master`.
2. Fill the [PR template](./.github/PULL_REQUEST_TEMPLATE.md) end to end. Empty checkboxes are reviewer signal that you have not done the work; the PR will be sent back.
3. Confirm CI is green: build, typecheck, smoke suite, CodeQL.
4. One maintainer approval is required to merge.
5. Maintainers may request changes that align the PR with the [SPEC.md](./SPEC.md) normative requirements (`MUST`, `MUST NOT`, `SHOULD`). The spec is the contract; please read the relevant section before disagreeing.
6. Squash-merge is the default. Keep your branch tidy; you do not need to fold every fixup commit yourself, the squash-merge will handle it.

## Release process

Releases are maintainer-only. The flow is:

1. Update `CHANGELOG.md`: move entries from `## [Unreleased]` into a new `## [X.Y.Z] — YYYY-MM-DD` section.
2. Bump the `version` field in `package.json`.
3. Open a release PR titled `release: vX.Y.Z` containing those two changes only.
4. Merge to `master` and tag: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`.
5. Run `./deploy.sh <project-id>` to push the corresponding image to Cloud Run.

## Adding a translation

The current locales are `en` and `hi`. To add a new locale:

1. Copy `src/locales/en.json` to `src/locales/<code>.json` and translate every key. Do not omit keys; missing keys fall back to English at runtime, but a partial translation is not accepted into `master`.
2. Add the locale code to the allowed list in `src/i18n.ts`.
3. Add the option to the locale picker in `src/views/partials/nav.ejs`.
4. Run `npm run build && npm run start` and verify every page renders, including form errors and the admin SIEM.
5. Open the PR with the [i18n issue template](./.github/ISSUE_TEMPLATE/i18n.yml) referenced in the body.

The HTML is RTL-ready: the `dir` attribute is set per locale so layout does not need to change for Arabic, Urdu, or Hebrew.

## Where to find help

- Setup, architecture, and deployment: [README.md](./README.md).
- Normative behaviour and security model: [SPEC.md](./SPEC.md).
- Questions and ideas: [GitHub Discussions](https://github.com/divyamohan1993/gharsetu/discussions).
- Confirmed bugs and concrete feature proposals: [GitHub Issues](https://github.com/divyamohan1993/gharsetu/issues).
- Vulnerabilities: `security@dmj.one` or the [private advisory form](https://github.com/divyamohan1993/gharsetu/security/advisories/new). See [SECURITY.md](./SECURITY.md).

## Recognition

Contributors are acknowledged in [AUTHORS.md](./AUTHORS.md) and in the next [CHANGELOG.md](./CHANGELOG.md) entry under the relevant section. Your name lands in `AUTHORS.md` when your first PR merges.

Thank you for keeping the bar high.
