# Governance

This document describes how GharSetu is governed. The project is small and student-led; the rules below match that reality.

## Project status

GharSetu is a capstone-stage open-source project. It runs in production at <https://gharsetu.dmj.one> on a personal Google Cloud project. Day-to-day ownership sits with the author, **Akshit Thakur**. Deployment, infrastructure, and architectural sign-off sit with the technical mentor, [@divyamohan1993](https://github.com/divyamohan1993).

## Roles

- **Author / primary maintainer** — Akshit Thakur. Triages issues, reviews PRs, sets the roadmap, ships releases.
- **Technical mentor / deployment owner** — @divyamohan1993. Owns production infrastructure, signs off on architecture-changing PRs, holds final veto on PRs that contradict `SPEC.md`.
- **Contributors** — anyone who has an accepted PR. Contributors may be invited to join as maintainers after sustained, high-quality contributions.

## Decision making

- **Lazy consensus** is the default. PRs that pass CI, follow `CONTRIBUTING.md`, and have at least one maintainer approval are merged.
- **Maintainer veto** applies to architecture-changing PRs that contradict `SPEC.md`. Such PRs require an updated SPEC entry first, agreed in a separate Discussion thread.
- **Conflict resolution** — if maintainers disagree, @divyamohan1993 has the casting vote.

## Roadmap

The roadmap is curated by maintainers from open Discussions. Items move from "Roadmap" Discussions to issues only when a maintainer commits to shipping them.

## Adding a maintainer

A new maintainer is added when:

1. They have three sustained months of high-quality contributions (PRs, issue triage, reviews, translations).
2. An existing maintainer nominates them in a private maintainers thread.
3. @divyamohan1993 approves.

Maintainers are listed in `AUTHORS.md`.

## Removing a maintainer

A maintainer is removed when they:

- Resign, or
- Are inactive for six months without notice, or
- Violate the Code of Conduct, after a documented review by remaining maintainers.

Removal is decided by a unanimous vote of the remaining maintainers, with @divyamohan1993 holding the casting vote.

## License changes

Changing the project license requires:

- Unanimous maintainer approval, AND
- A 90-day public notice in a pinned Discussion, AND
- Sign-off from @divyamohan1993.

## Contact

- General questions: GitHub Discussions
- Maintainer business: `contact@dmj.one`
- Code of Conduct enforcement: `conduct@dmj.one`
- Security: `security@dmj.one` and the GitHub Private Vulnerability Reporting tab
