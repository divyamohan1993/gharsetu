# Genesis — Why GharSetu Exists

This document is the founding story behind GharSetu. The engineering contract lives in `SPEC.md`; this one is the why.

---

## 1. The conversation that started it

> Jo ek app hh jo ek particularly loaction pe chalega jo wahan ke logo ko help krega jisme woo app help krega un logo ko unke room rent pe dalne ke lie logo ko help kerga
>
> Online ye sab provide hoga to ye chiz bohot pareshan kerte hh day scholar students ko islie mane ye topic socha hh
>
> Ok so Localized Room Renting platform
>
> A localized renting platform - all conencted through ondc to provide a centralized access. this renting platform wil help in very small area locally like near university campus to get rooms and pg's and will be used by students.

> *— Akshit Thakur, WhatsApp message, 30 April 2026, 19:45 IST*

Translation of the Hindi/Hinglish portion: *"An app that runs in a particular location and helps the people who live there — it helps them put their rooms up for rent. Putting all of this online would help, because this is something that really troubles day-scholar students. That's why I thought of this topic."*

The first three lines are the unfiltered observation of a student who has just spent his last fresher year living through the problem he is now trying to solve. The fourth and fifth lines are the same observation re-stated in the language of a product brief. Both halves matter; one without the other would have produced something less honest.

The decision was made to keep the original message in the document — verbatim, mistakes and all — rather than polish it down to something more presentable. Every product worth building has a moment where it stops being an idea in someone's head and starts being a thing in the world. For GharSetu that moment was a WhatsApp message at quarter to eight in the evening. The version of the project that survives review and goes to public launch should be able to look back at this paragraph and recognise itself.

---

## 2. The problem in plain terms

### 2.1 The day-scholar squeeze

Imagine a 17-year-old who has cleared a B.Tech entrance and arrives in Solan (or Greater Noida, or Vellore, or Manipal) for the first time. They have one suitcase, parents who are already on the train back, and a deadline of about seventy-two hours before college starts. They need a place to sleep, eat, and study for the next four years.

What they have to work with: a phone with patchy data, a list of phone numbers from a senior who graduated last year, and the names of two brokers a relative recommended. What they don't have: any honest sense of which rooms are decent, which owners are fair, what a reasonable rent looks like for the area, or whether the bathroom in the picture is actually the bathroom they will be using.

Every PG visit costs half a day — auto fare, locating the building, the polite tour, the polite tea, the awkward "I'll get back to you". Every wrong choice costs a deposit, typically one to two months of rent locked behind a verbal promise that does not survive a dispute. By the time the third week starts and classes have begun and the student realises the wifi does not actually work, the cost of moving has compounded with the cost of staying. The cost of getting it wrong falls entirely on the student, because the student is the only person in the chain who cannot walk away.

Multiply that by every fresher batch in every campus town. Solan alone has roughly three thousand new B.Tech students arriving every August. Their parents collectively spend tens of crores on PG rent in a city most of them have never visited. Each rupee of that is allocated under information conditions that would be unacceptable in any other market.

### 2.2 Why the current options fail

There are three working options today, and each one fails for a different reason.

- **Brokers** charge half-a-month or one full month of rent as commission, sometimes from both sides. Their incentive is to close, not to fit. The student finds out which mattered only after moving in. There is no consequence for the broker when the room fails to match the description; the commission has been collected, the chain is broken, and the student is one customer in a year of customers. A bad fit is somebody else's problem.
- **Scattered WhatsApp groups** ("Solan PG hunters 2026", "Shoolini girls accommodation") are higher-trust than brokers but lower-coverage. Listings are unstructured ("DM for details"), unsearchable (you have to scroll three weeks back), and impossible to filter. There is no concept of "verified". The information dies the moment the message scrolls off the visible portion of the chat. A student joining the group in July loses access to everything that was posted in May, even though those posts may still be the most relevant ones.
- **National listing portals** (Magicbricks, NoBroker, NestAway in tier-1 cities) over-cover the long tail of large flats and under-cover the segment of one-room PGs near a single university. They also speak the language of an investor or a working professional, not a fresher with a 7000-rupee monthly budget. The default filters assume "BHK count" matters more than "distance to Gate 2". They also insist on government-grade KYC for owners, which is correct for a 50 000-rupee flat in Bandra but excludes the elderly couple in Solan with one room above their garage.

The result is that for a student moving to a tier-2 university town, none of the three options actually solves the problem. They cobble together a "good enough" solution and absorb the cost of the misfits. A single weekend of PG-hunting in an unfamiliar city can cost the equivalent of a month's rent in lost time, taxi fare, and bad decisions made under fatigue.

### 2.3 The information asymmetry that hurts students most

The single sentence that captures the problem: *"I cannot tell whether this PG is honest until I have moved in and lost my deposit."*

Photos lie. Sample-size-of-one reviews from a senior lie too — that senior had their own constraints, their own room, their own quiet relationship with the owner. The owner has every reason to make the room sound better than it is, and no real consequence if it isn't. The platform that intermediates them today (be it a broker, a Facebook group, or a Magicbricks listing) does not differentiate between a review written by someone who actually lived in the room and one written by someone who walked past the door. A five-star rating from a stranger is indistinguishable from a five-star rating from a real renter, so over time both lose meaning equally.

The information asymmetry is one-sided. Owners know who their previous renters were, what they paid, and how they left. Students know none of that. They walk into the same negotiation every time without the context that the other side already has. Closing that gap — even partially — is the entire point of GharSetu.

---

## 3. The insight

The problem is local but the trust mechanism is universal.

A platform that solves PG rentals near Shoolini University in Solan does not need to be the same platform that solves PG rentals near LPU in Phagwara. The geography is hyperlocal, the language preferences are regional, the rent bands are city-specific. The owner who lists on GharSetu does not need to know about a student in Phagwara, and vice versa. But the discovery layer — the protocol by which a buyer-side app (a student's phone) finds a seller-side app (a PG owner's listing) — can and should be standardised across all of them.

That standardisation already exists in India. It is called ONDC (Open Network for Digital Commerce), built on top of the open Beckn protocol, and the Government of India has been pushing it as the default unbundling layer for digital commerce. The thesis behind ONDC is that the supply side of any market should not have to choose a single platform to be discovered on; the discovery layer should be a public utility, not a winner-take-all moat.

By speaking Beckn natively from day one, GharSetu can be a small first-party listing platform near Shoolini University *and* a node in the larger ONDC network at the same time. Two consequences follow. First, a future student-focused buyer-app from anywhere in India can discover GharSetu's listings without GharSetu having to negotiate a bilateral deal. Second, a future GharSetu-built buyer-app can discover listings from any other ONDC-connected provider without bilateral integration the other way. The protocol is symmetric.

That is the insight: **own the local trust layer, federate the discovery layer.** The first half is what students pay for. The second half is what stops the platform from becoming a walled garden the day it succeeds.

A short note on why this combination is non-obvious. Most consumer-internet startups in India default to one of two stances: either they centralise both layers (the Magicbricks model — own the listings, own the discovery, charge on both sides) or they centralise neither and become a glorified directory (the local-classifieds model — list whatever, discover whatever, take no responsibility). The verified-renter mechanic and the Beckn integration together produce a third stance: high responsibility for trust, low ownership of distribution. That third stance is what the protocol layer makes possible, and what no commercial platform in this segment has yet committed to.

---

## 4. The design choices

These are the five decisions that distinguish GharSetu from a generic rental site. Each one was a fork in the road where the easier choice would have produced a different product. The choices below have been made consciously, with full awareness of what they cost.

### 4.1 Localised first

The MLP solves for one campus — Shoolini University in Solan, Himachal Pradesh — before it tries to solve for any other. The seed data targets that single campus. The default city in `src/config.ts` is Solan. The currency is rupees, no localisation switch needed. The aim is for one cohort of one fresher batch to actually use it for real, end-to-end, before adding a second campus.

This is opposite to the standard "go national from day one" instinct of consumer-internet companies. The bet is that 200 students who actually used the product is better evidence than 20 000 who saw an ad. A small, dense, local market also makes the trust loop tight: a student who has a bad experience can talk to ten others by next morning, and that signal arrives back at the platform in days, not quarters.

### 4.2 Federated by ONDC

GharSetu is **not** an island. From day one it speaks Beckn. The `/ondc/v1/*` route surface (see `SPEC.md` section 7.14) implements the full nine-action choreography (`search`, `select`, `init`, `confirm`, `status`, `cancel`, `update`, `rating`, `support`) as a Seller App (BPP). Even when the network is simulated, the wire format is real. Every inbound and outbound payload is logged verbatim into `ondc_messages`, indexed by transaction id, so any future arbitration is decidable from the database alone.

This means: the day a real student-focused buyer-app launches in India and connects to ONDC, GharSetu's listings appear in their search results without GharSetu having to be discovered. Supply is not trapped on a single platform. Equivalently, on the buyer side, a future GharSetu mobile app can call the same protocol against any other ONDC-connected provider — for example a furniture rental, a tiffin service, or a moving company that a student also needs in the same week — without writing a per-provider adapter.

This is more than an architectural preference. It is a hedge against the central failure mode of platform startups, which is that they accidentally become the thing they were built to disrupt. By committing to the protocol before there is any commercial reason to, GharSetu makes that failure mode mechanically impossible.

### 4.3 Verified-renter feedback

The most important design decision in the entire product is the boolean column `feedback.is_verified_renter`. A review written by someone who actually paid rent counts differently from a review written by someone who walked past the door. That single distinction is the difference between a feedback list that students trust and one that students learn to ignore.

The mechanism is described normatively in `SPEC.md` section 10. Briefly: a feedback row carries the verified badge if and only if the author has either (a) been marked as a renter by the owner, or (b) made a successful platform payment for that listing. The student does not get to choose; the platform decides server-side based on facts in the database. The two creation paths converge on a single `renter_records` row protected by `UNIQUE(listing_id, student_id)`, so an owner cannot inflate the count by double-marking and a student cannot inflate it by paying twice.

Outsider reviews are not deleted. They are surfaced with a distinct badge, separated visually, and de-emphasised in the aggregate rating computation. The platform does not pretend they don't exist; it just refuses to let them carry the same weight as a real renter's review. That symmetry — verified counts more, but outsider still counts — is what stops the badge from becoming a censorship tool.

### 4.4 Slow-phone first

Every architectural decision is anchored to a single user image: a 17-year-old with a sub-Rs.10 000 phone, on 2G in a hill station with patchy connectivity, trying to read a PG listing on a balcony at dusk. If the page does not render in 2 seconds on that device, it does not exist for that user.

This dictates the entire stack. Server-rendered EJS, no client framework. Inline critical CSS. Lazy-loaded Leaflet only on map pages. WebP images at quality 78. A service worker that caches the shell after the first visit so the second visit is instant. Performance budgets enforced in `SPEC.md` section 13.

The cost of this discipline is real. The team cannot reach for the comfortable React component library. Every interactive widget has to be hand-written and accessibility-tested. Every kilobyte of JavaScript has to justify itself. The reward is a product that loads in places where the competition does not. For the user described in the previous paragraph, that is the entire difference between a usable platform and a beautiful demo.

### 4.5 Bilingual from day one

Every string in the user interface is keyed and translated. The English and Hindi dictionaries are at parity (`src/locales/en.json`, `src/locales/hi.json`). Language is detected from the cookie first, then `Accept-Language`, then a configurable default. CSS uses logical properties so that adding an RTL language later is a matter of one HTML attribute.

This is not a "feature added in v2 if there is demand". A product that asks an Indian fresher to read English-only forms during the most stressful week of their life has misunderstood who its user is. The right test is to imagine the same fresher's parents — who are paying the deposit and who often do not read English fluently — sitting at the same screen. If they cannot follow the form, the form is broken.

The next two languages on the roadmap are Punjabi and Tamil, in that order, driven by the campus geographies that GharSetu is most likely to expand into after Solan.

---

### 4.6 Verified-renter does not mean verified-truth

A subtle point worth surfacing: a verified-renter badge says the author actually rented the listing. It does not say their review is correct or fair. A verified renter can leave a one-star review for petty reasons; an outsider can leave a five-star review that captures something true. The badge is a signal about the author's standing, not a judgement on the content.

This distinction matters because the alternative — moderating reviews for "fairness" — is the path that turns a platform into a censor and an arbiter. GharSetu chooses to label, not to filter. The user does the inference. That is consistent with how every honest review system works, from Wikipedia to Stack Overflow to the corner-shop owner who has been there for thirty years and has heard everything.

---

### 4.7 Honesty about the simulation

The MLP simulates DigiLocker, Razorpay, and ONDC. Each simulation is wire-compatible with the real system but does not require the real system to run. This is a deliberate engineering decision, not a shortcut.

The reason is that a capstone defense in May 2026 cannot wait on three external integrations whose approval timelines are measured in months. ONDC subscriber registration, DigiLocker MeitY approval, and Razorpay live-key activation each depend on paperwork, demos, and review queues that the project cannot control. If any one of those slips, the entire defense window slips with it. Building wire-compatible simulations means the product can be defended honestly today and switched to live in production tomorrow without rewriting the route layer.

Each simulated route file (`src/routes/ondc.ts`, `src/routes/payments.ts`, `src/routes/verification.ts`) carries a `===== REAL PROD CODE (replace stub on launch) =====` comment block at the top, with the production wiring already drafted line-by-line. The simulation is not a placeholder; it is the same shape as the real thing, with one branch swapped out.

---

## 5. What success looks like for the MLP

The MLP is judged against a small, concrete, verifiable list. Each item is testable today. None of the items below is "we built a feature"; each is "the product behaves correctly from the user's perspective". This is the difference between an engineering deliverable and a product deliverable, and it is the right axis on which to measure a capstone.

1. **Seeded supply.** Six PG/room listings within walking distance of Shoolini University Gate 2 render correctly on `/`, `/search`, and `/listings/:id`, with at least one image, geocoordinates, and the `near_landmark` field populated.
2. **Three personas, end-to-end.** A demo student account, a demo owner account, and the bootstrap admin account can each complete their core journeys: student signs up, searches, requests a visit, leaves feedback; owner publishes a listing, accepts a booking, marks a renter; admin opens `/admin` and sees the real-time audit feed.
3. **ONDC handshake.** `POST /ondc/v1/search` with a valid Beckn envelope returns a 200 ACK and asynchronously dispatches `on_search` to the `context.bap_uri`. The transcript is visible in `ondc_messages`. (Verified by `tests/smoke.mjs`.)
4. **Verified-renter badge.** Two feedback rows on the same listing — one by an active renter, one by a non-renter — render with distinguishable badges in the listing detail page. The boolean is computed server-side and matches the algorithm in `SPEC.md` section 10.
5. **Zero idle cost.** The deployment runs on Cloud Run with `min-instances=0`. A single 24-hour quiet period costs nothing. First request after scale-to-zero serves within 1.5 s.
6. **WCAG 2.2 AAA, English plus Hindi, audit log, secrets in Secret Manager.** All four are visible in code: contrast ratios in the stylesheet, parity in `src/locales/`, `audit_log` rows for every mutation, `--set-secrets` bindings in `cloudbuild.yaml`.

If all six are true, the MLP has done what it set out to do.

---

If any one of these is false on demo day, the MLP has not earned its name. The list is short enough to be auditable in a single working session.

---

## 6. What is intentionally out of scope for the MLP

It is as important to be honest about what GharSetu is **not** trying to do at this stage. The line between "future work" and "we forgot" is the most important line in any defensible engineering project, so it is worth drawing carefully.

- **Cloud SQL.** Storage is SQLite on `/tmp`, ephemeral by design. The schema is portable and the migration is documented in `SPEC.md` section 22, but the MLP does not need it. Demo data is re-seeded automatically on cold start, which is the right behaviour for a defensive review where reviewers may want a clean state.
- **Native mobile app.** The web surface is the only client. A future React Native or Capacitor wrapper is straightforward when there is a reason to ship one. The PWA shell, manifest, and service worker mean the existing site can be installed to a phone home screen today.
- **Real ONDC subscription.** The `/ondc/v1/*` surface is wire-compatible but unsigned. Real subscription requires Ed25519 key registration with the ONDC Registry; the production wiring is documented in `src/routes/ondc.ts` and `SPEC.md` section 21.
- **Real Razorpay account.** Order creation is locally minted; webhook signature verification is real (HMAC-SHA256 with constant-time compare). Switching to live keys is one config change.
- **Real DigiLocker integration.** OAuth flow is stubbed; the production code path with PKCE is documented in `src/routes/verification.ts`.
- **Payment reconciliation back-office.** Owner payouts, GST invoices, settlement reports — none of these exist yet. The MLP confirms that a payment can be captured and converted into a renter record. Everything beyond that is a separate product, served by a separate set of users (operations and finance), and deserves its own design pass rather than being smuggled into the consumer surface.
- **Multi-campus seed data.** The seed targets Shoolini University. Adding a second campus is a JSON file plus a few photos; deferring it keeps the demo focused.
- **Owner-side dispute handling.** When a student leaves a one-star verified review, the owner currently has no formal redress path. A dispute workflow (mediator queue, evidence upload, time-bound resolution) is the next consumer-facing feature once the cohort pilot starts producing real disputes.

These omissions are deliberate. Each one is an honest line-item, not a hidden assumption. A capstone reviewer should be able to point at any of them and find a paragraph here explaining the choice, rather than discovering the gap by accident in a corner of the codebase.

---

## 7. The path from MLP to product

If the MLP defends well in May 2026, the next five things — in order — are:

1. **Validate with one campus cohort.** Run the simulated platform with 6 seeded listings and 30–50 real Shoolini freshers in the August 2026 intake. Treat their journey as the actual product spec and rewrite anything that breaks under real use. The most useful artefact from this phase is not a feature list but a corrections list: every place where a real student's expectation diverged from what the MLP assumed.
2. **Migrate storage off `/tmp`.** Cloud SQL for PostgreSQL in `asia-south1`, with Cloud Storage for images behind a CDN. Track this against `SPEC.md` sections 18 ("Operational runbook") and 22 ("Open issues"). The schema is portable; the migration script is the SQLite dump translated to Postgres syntax. The application layer changes only at the database driver boundary.
3. **Apply for ONDC subscriber registration.** Submit the BAP and BPP applications to ONDC, generate the Ed25519 keypairs, plug them into Secret Manager, ship the signing changes documented in `src/routes/ondc.ts`. Pass the Beckn protocol vendor-validator. Coordinate with the local university authority for an institutional letter of support, which materially shortens the review queue.
4. **Replace the DigiLocker and Razorpay simulations with the real wiring.** The replacement code is already documented as comment headers in `src/routes/verification.ts` and `src/routes/payments.ts`. Both paths are designed so that the swap is one file. The signature verification on the Razorpay webhook is already production-grade today; the swap is purely on the order-creation side.
5. **Add the missing notification delivery.** Today `notify.owner_new_booking` and `notify.student_booking_decision` are audit rows only. Wire up an SMS/email adapter (MSG91 plus SendGrid) on the `notify.*` audit hook so owners actually find out when a student requests a visit. SMS is the only channel that reliably reaches the older PG-owner demographic, and missing this is the single biggest blocker to the platform being usable in real life.

That sequence — validate, persist, federate, integrate, notify — takes GharSetu from a defensible capstone artefact to a service that one university campus can actually depend on. None of the five steps requires throwing away code that exists today; each is an additive change against the contract documented in `SPEC.md`.

---

### 7.1 What this sequence does not do

It does not promise growth. None of the five steps is "acquire ten thousand users" or "raise a seed round" or "expand to ten campuses". Those are downstream of the product working, and the order is important. A platform that scales before it works is a platform that builds its problems into the foundation. A platform that works before it scales has the easier remaining problem.

The cohort pilot in step 1 will likely surface uncomfortable findings. Some of the verified-renter assumptions may turn out to be wrong in practice — perhaps the owner-mark path is gamed in ways the spec does not anticipate, or the payment-capture path produces false positives because students share rooms but only one pays. These corrections are the actual product roadmap. They cannot be planned into the spec today; they have to be earned by running the thing.

---

### 7.2 What changes for owners

So far this document has been written from the student's side. The owner side deserves a paragraph.

The typical Solan PG owner is in their fifties or sixties, has two or three rooms above their main residence, and finds renters today through a combination of word-of-mouth and a small board outside the gate. They are not technologically sophisticated, but they are not illiterate either. They have a smartphone, they use WhatsApp daily, and they are perfectly comfortable accepting a UPI payment.

What they are not comfortable with is the broker who takes commission on both sides, the student who disappears after a verbal agreement, and the deposit dispute that has no formal resolution path. A platform that gives them a clean visit-request inbox, an automatic verified-renter list, and a payment trail that survives in writing is a platform they will use. The MLP gives them all three.

What it does not yet give them is the audience. A listing on GharSetu reaches GharSetu's user base only. The ONDC federation is the long-term answer to that, but in the short term the cohort pilot has to seed the supply side as carefully as the demand side. This is why step 1 of section 7 is bidirectional: validate with both freshers and owners, and treat their pain points as equally weighted.

---

### 7.3 The cost of getting any of this wrong

A failure mode to be honest about: any of steps 2 through 5 could go wrong without immediately killing the product. A delayed Cloud SQL migration just means more cold-start losses. A delayed ONDC subscription just means listings stay first-party-only for longer. A delayed Razorpay live-key activation just means rent collection happens out-of-band. A missing notification adapter just means owners check the dashboard manually.

But step 1 — validating with a real cohort — is load-bearing. If the cohort pilot is skipped or rushed, every later step ships against assumptions that were never tested. The biggest single risk to GharSetu becoming a real product is that the team gets impatient and ships steps 2-5 before step 1 has produced its corrections list. The order is not negotiable.

---

## 8. Why this is the right shape for a capstone

A B.Tech CSE (Cybersecurity) capstone has to do three things at once. It has to demonstrate that the candidate can ship a complete system end-to-end. It has to show defensible engineering decisions on every axis a reviewer might probe. And it has to address a problem that matters in the world the candidate is graduating into. GharSetu is shaped to do all three.

On the systems axis, it spans the full stack: an HTTP service, a database, an auth layer, an image pipeline, an i18n layer, a service worker, an admin SIEM, a Beckn protocol surface, a CI/CD pipeline, and a Cloud Run deployment with secrets management. Every layer is real and runs together; nothing is mocked away to make the diagram look cleaner.

On the security axis (the candidate's specialisation), the surface is honest about its threat model. Section 19 of `SPEC.md` walks STRIDE-lite category by category. CSRF, JWT revocation, HMAC webhook verification, redactor lists, role-based authorisation, rate limiting, and constant-time comparisons are not bolted on; they are integrated into the route-level contracts from the first commit.

On the relevance axis, the problem is one the candidate has lived through, the user is a recognisable real person, and the regulatory layer (DPDP Act 2023, ONDC subscription, accessibility) is the layer the country is actually building toward. A capstone that picks a problem from a textbook is easier to defend but harder to care about. GharSetu picks a problem from the candidate's own life and defends it on textbook-grade rigour.

---

## 9. A note on the name

`Ghar` (घर) means home. `Setu` (सेतु) means bridge. The product is the bridge between a student looking for a home and an owner looking for a renter, in a market where neither side has had a fair information channel before. The tagline is *Apna kamra, apne sheher mein* — your room, in your city.

The English and Hindi name halves were chosen on purpose. A Sanskrit-derived word reads as serious in Indian regulatory contexts (the kind of contexts that ONDC certification and DPDP Act 2023 compliance live in). An everyday word like `Ghar` keeps the brand close to the user. Together they signal that the product takes both the policy layer and the user layer seriously.

---

## 10. Document conventions

This document is the *why* layer. The *how* layer lives in `SPEC.md`, which is normative engineering reference material. When the two documents disagree, `SPEC.md` is the source of truth for what the system does today and `idea.md` is the source of truth for why those choices were made. Both files belong to the project; neither is a marketing document.

Reviewers reading both in sequence should start here, then move to `SPEC.md` for the contract. The README at the repository root is a third file aimed at a developer who wants to run the project locally, and is intentionally shorter than either of these two.

This file should be re-read whenever a major design decision is being reconsidered. The product can change. The constraints in section 4 should not change without an explicit, documented reason — and that reason should be added back to this file as a footnote, not erased from history.

---

## 11. Acknowledgement

GharSetu is built by Akshit Thakur as the B.Tech CSE (Cybersecurity) capstone for Shoolini University, May 2026.

The project is dedicated to the freshers who arrive at Solan every August with one suitcase and a phone and have to find a home in seventy-two hours, and to the parents who pay the deposit on faith.

The promise of this product is that the next batch will have to find one fewer thing on faith.
