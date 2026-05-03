## Summary

<!-- One paragraph: what does this PR do, and why? -->

## Type of change

- [ ] feat — new feature
- [ ] fix — bug fix
- [ ] docs — documentation only
- [ ] refactor — code change that neither fixes a bug nor adds a feature
- [ ] perf — performance improvement
- [ ] test — adding or updating tests
- [ ] chore — tooling, dependencies, build
- [ ] ci — CI configuration
- [ ] revert — revert a previous commit

## Linked issues

Closes #

## Checklist

- [ ] `npm run lint` passes locally
- [ ] `npm run build` passes locally
- [ ] `npm test` passes locally (10/10)
- [ ] If a user-facing string was added or changed, **both** `src/locales/en.json` AND `src/locales/hi.json` are updated.
- [ ] If a route handler was added or changed, it calls `audit({...})` on every mutation.
- [ ] If a new state-changing POST route was added, it accepts the CSRF token.
- [ ] If a new env var was added, it is documented in `.env.example` and `SPEC.md`.
- [ ] No secrets, API keys, PII, or stack traces are logged or returned to users.
- [ ] Accessibility checked: keyboard navigation works, contrast ≥ 7:1, focus is visible.
- [ ] `CHANGELOG.md` updated under `## [Unreleased]`.

## Test plan

<!-- How did you verify this works? curl commands, screenshots, browser steps. -->

## Screenshots / GIFs (if UI)

<!-- Drag images here. -->
