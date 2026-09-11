# Angular 22 monorepo

Three applications, four libraries and one REST API in a single workspace:

- **Portfolio** — a public portfolio plus a signed-in workspace for editing every part of it.
- **FreshKart** — a food and grocery storefront: browse, cart, coupons, checkout, UPI / card /
  cash payment, and order tracking.
- **MediCare360** — a hospital platform with a patient panel and a doctor panel over a real
  Node backend: booking, consultations, prescriptions, lab reports, a medical store, payments
  and QR check-in.

Zoneless, signal-based, no UI library, no icon font, no animation library — every component,
icon and animation here is hand-written.

## Run it

```bash
git clone https://github.com/pc8104799-droid/pradeep-portfolio.git
cd pradeep-portfolio
npm install

npm start              # portfolio    -> http://localhost:4200
npm run start:shop     # FreshKart    -> http://localhost:4200
npm run api            # MediCare360 API -> http://127.0.0.1:3000/api
npm run start:medicare # MediCare360  -> http://localhost:4200

npm run build          # portfolio   -> dist/portfolio
npm run build:shop     # FreshKart   -> dist/shop
npm run build:medicare # MediCare360 -> dist/medicare
npm run build:libs     # libraries   -> dist/core, dist/ui, dist/shop-core
npm run build:all      # libraries then both apps

npm test               # portfolio:   45 specs
npm run test:shop      # FreshKart:   53 specs
npm run test:medicare  # MediCare360: 38 specs
npm run api:seed       # regenerate the hospital's demo data
```

MediCare360 needs the API running: two terminals, `npm run api` in one and
`npm run start:medicare` in the other. The sign-in screen fetches the four demo accounts from
the API and fills the form in one click, so there is nothing to memorise.

## FreshKart — the storefront

`npm run start:shop`. A complete ordering flow, all of it driven by JSON through services.

| Route | What it does |
| --- | --- |
| `/` | Offers, categories, bestsellers, kitchens, a live-order strip |
| `/menu`, `/menu/:category` | Search, category, diet and price filters, five sort orders |
| `/product/:id` | Variants, stock, related items |
| `/cart` | Quantities, coupons, delivery slot, undo on remove |
| `/checkout` | Saved addresses, slot, payment method (needs an account) |
| `/pay/:orderId` | UPI QR, sandbox card, or switch to cash |
| `/order/:orderId` | Stage tracker, timeline, bill, payment status |
| `/orders`, `/account` | History, addresses, totals |

### Payment — what is real and what is not

**UPI is real.** The payment page builds a standards-compliant `upi://pay` intent and renders
it as a QR, so GPay, PhonePe, Paytm or any bank app scans it with the payee and amount already
filled in. Set `config.upiId` in
[`catalog.json`](projects/shop-core/src/lib/data/catalog.json) to your own VPA — something
like `yourname@okhdfcbank` — to switch it on. It ships blank on purpose: a QR pays whoever it
names, so it must not go out with a guessed ID.

**Card is a sandbox.** A real gateway needs a secret key to create the order and verify the
signature, and that key cannot live in browser code. So the card form validates properly —
Luhn, brand detection, expiry, CVV length by brand — and then settles locally. Any valid
number works; one ending `0000` always declines, so the failure path is reachable.
`PaymentService.settle()` is the single seam to replace once a backend exists.

**Cash on delivery is real** — there is nothing to integrate.

Neither UPI nor cards can *confirm* that money arrived without a server callback, so a UPI
order is recorded as awaiting verification until it is checked.

### Store content

The whole store — config, 12 categories, 6 kitchens, 41 products with 73 variants, coupons and
delivery slots — is one file:
[`catalog.json`](projects/shop-core/src/lib/data/catalog.json). It is bundled as a fallback
and also copied to the site root and fetched at startup, so the deployed catalog can be edited
without a rebuild. The support email and phone come from `config` too.

## MediCare360 — the hospital platform

`npm run api` in one terminal, `npm run start:medicare` in another. Unlike the other two
applications, this one is not driven by a bundled JSON file: it talks to
[`server/`](server/README.md), an Express API over a JSON document store, and every rule that
matters is enforced there rather than in the browser.

Two panels behind role guards, each with its own sidebar and its own lazy chunks.

### Patient panel

| Route | What it does |
| --- | --- |
| `/patient/dashboard` | The one thing to act on next, then tiles, current medicines, recent reports, health summary, spending |
| `/patient/doctors` | Search 24 consultants across 17 departments — department, branch, availability date, gender, fee ceiling, experience, language. Filters live in the URL |
| `/patient/doctors/:id` | Profile, published weekly hours, next free slot, upcoming leave |
| `/patient/book` | Six steps: department → doctor → date → slot → reason → review |
| `/patient/appointments` | Upcoming / past, with the action each row actually needs |
| `/patient/appointments/:id` | Pay, check in, reschedule against live slots, cancel; QR for reception |
| `/patient/prescriptions/:id` | The printable slip, plus "order these medicines" |
| `/patient/records` | Visits, prescriptions, reports and what is booked next, as one dated timeline |
| `/patient/records/:id` | The whole visit: notes, vitals, prescription, reports, follow-up |
| `/patient/reports` | Released results **and** tests still with the lab |
| `/patient/pharmacy` | 46 medicines in 11 categories; ℞-only items priced but not purchasable |
| `/patient/pharmacy/cart` | Every total priced by the server; blocked and out-of-stock lines called out |
| `/patient/pharmacy/checkout` | Address, slot, then order + pending payment |
| `/patient/pharmacy/orders/:id` | Six-stage tracking built from what the server recorded |
| `/patient/pay/:paymentId` | Six methods, a declined-payment path you can trigger deliberately |
| `/patient/payments/:id` | A printable receipt with the tax breakdown |
| `/patient/family` | Household members, each with their own blood group, allergies and guardian rule |
| `/patient/emergency` | A wallet card that prints: blood group, allergies, medicines, who to call |
| `/patient/qr` | Scan any MediCare360 code, or show your own |

### Doctor panel

| Route | What it does |
| --- | --- |
| `/doctor/dashboard` | Who is waiting right now, then today, totals, earnings and four charts |
| `/doctor/queue` | The working screen: call, start, complete, mark absent — by token |
| `/doctor/consultation/:appointmentId` | Six steps: history → examination → diagnosis → prescription → tests → close |
| `/doctor/patients/:id` | Clinical timeline, prescriptions, reports, visits — with allergies at the top |
| `/doctor/reports` | Tests awaiting results, and released reports to annotate |
| `/doctor/availability` | Weekly hours and leave. What is published here is what patients can book |
| `/doctor/earnings` | Today / week / month / outstanding, with every transaction |

### The flow that ties it together

```
patient books ─→ pays ─→ appointment confirmed ─→ checks in, gets a token
                                                        │
doctor sees the queue ─→ starts the consultation ─→ diagnosis
                                                        │
                          prescription ─→ lab test requested
                                                        │
                            consultation completed ─→ medical record written
                                                        │
patient is notified ─→ reads the record ─→ orders the medicines ─→ pays ─→ tracks delivery
                                                        │
                                            follow-up booked from the record
```

Every arrow is a request to the API, and every step writes the notification the other side
sees. Nothing on either panel is a screen that only looks the part.

### What is real, and what is not

Real:

- **Pricing.** Consultation fee, 5% service charge, 18% GST, a 40% insurance co-pay, follow-up
  detection within 30 days, pharmacy GST and the free-delivery threshold — all computed
  server-side. The client sends choices, never amounts.
- **Slot availability.** Derived from the doctor's hours, their leave and the bookings that
  exist. Two patients racing for 10:30 means the second gets a `409`, not a double booking.
- **Role enforcement.** A patient cannot read another patient, a doctor cannot read a patient
  they have never treated, and a QR code resolves only to what the scanner is entitled to see.
- **The allergy check.** Prescribing something a patient reacts to is refused until the doctor
  confirms it deliberately.
- **Stock.** Decremented when an order is placed, returned when it is cancelled.

Not real:

- **No money moves.** `/payments/:id/pay` decides an outcome and writes the bookkeeping around
  it. The `simulate` flag is exposed in the UI so the failure path can be demonstrated, because
  a payment screen that only ever succeeds has not been finished.
- **No ambulance.** The emergency button runs a simulation and says so on the page.
- **The store is a JSON file.** Fine for a demo, not for a hospital.

### Themes

Six themes — Light, Dark, Blue Healthcare, Green Healthcare, Purple, High Contrast — switched
from the header, the account menu, the sign-in screen or `/patient/settings`, and remembered per
browser. They are not six stylesheets: every colour in the application is a semantic token
(`--primary`, `--surface`, `--danger-soft`), and a theme is one block that redefines those
tokens against `<html data-theme>`. That is why High Contrast can exist — pure black on white,
full-strength borders, a thicker focus ring — without a single component knowing about it.
Layout density (`comfortable` / `compact`) works the same way on the spacing scale, which is
what makes the dense staff tables usable on a reception desk.

## Portfolio — the three areas

`npm start`. The original application: a public one-page portfolio, plus a signed-in workspace
that edits every part of it.

| Route | What it is | Account needed |
| --- | --- | --- |
| `/login`, `/register` | Sign in, or create the first account | no |
| `/dashboard/*` | The workspace — header, resume sections down the left, swappable centre pane | yes |
| `/portfolio` | The public one-page portfolio | no |

`/` sends you to the workspace if you are signed in, and to `/login` if not.

### The workspace

Header on top, the resume down the left, status bar at the bottom — **only the centre pane
changes** as you move between sections. Each section page has two tabs:

- **Preview** renders the *actual* component from the public site, so what you see is what
  visitors get.
- **Edit** shows the editors for the content behind it — add, edit, reorder and delete, with
  required-field validation.

Sections: Overview, About, Skills, Experience, Projects, Education, Contact, Navigation, plus
Export & import.

### About the login

**This is a gate, not security.** There is no server, so accounts and the session live in this
browser's `localStorage`, and anyone with devtools can read or forge them. Passwords are never
stored — only a PBKDF2-SHA-256 derivation with a per-account salt, via Web Crypto — so a shared
machine does not leak the password itself. But anything that genuinely needs protecting has to
be enforced by a backend, which a static site does not have. Do not reuse a password you rely
on elsewhere.

## Content

Everything the site renders comes from **one file**:
[`projects/core/src/lib/data/content.json`](projects/core/src/lib/data/content.json).

It is loaded twice over: bundled at build time as a fallback, and copied to the site root and
fetched at startup. So you can either

1. edit it in the workspace and use **Export & import** to download the file and commit it, or
2. edit the JSON directly — including on the deployed host, which updates the site with no
   rebuild.

A missing, malformed or outdated file can never blank the portfolio: load order is local edits
→ fetched file → bundled copy, and any branch an older file is missing is filled from the
bundled one.

### Adding a new kind of content

The workspace is generated from two config files, not from bespoke components:

- [`content-schema.ts`](projects/core/src/lib/schema/content-schema.ts) — the fields of every
  editable collection. Field types: `text`, `textarea`, `number`, `boolean`, `list` (one entry
  per line), `color`, `icon`.
- [`dashboard-nav.ts`](projects/portfolio/src/app/dashboard/dashboard-nav.ts) — the sidebar,
  and which preview and editors each page shows.

Add an entry to each plus a branch in `content.json`, and you get a sidebar item, a route, a
CRUD list and a validated form. No new component.

## Workspace layout

```
server/                  MediCare360 REST API (Express, no database)
  src/db/                document store + the demo-hospital seed
  src/lib/               jwt, password, billing, slots, query, validation
  src/middleware/        session, role and ownership guards, error envelope
  src/routes/            one module per area of the hospital
  data/db.json           generated on first boot

projects/
  medicare/              MediCare360 — patient and doctor panels
    src/app/layout/      role-aware shell, sidebar, header
    src/app/shared/      data-state, atoms, charts, dialogs, QR, controls, pipes
    src/app/features/    auth, patient, doctor, pharmacy, shared-pages
  medicare-core/         @pc/medicare-core — models, HTTP, async state, guards,
                         one service per area. No components
  shop/                  FreshKart storefront
    src/app/pages/       home, catalog, product, cart, checkout, payment,
                         order, orders, account, auth, not-found
    src/app/layout/      header, footer, phone tab bar
    src/app/shared/      product card, qty stepper, bill, UPI QR, toasts
  shop-core/             @pc/shop-core — catalog, cart and bill, addresses,
                         payments, orders
  core/                  @pc/core — state, no UI
    src/lib/models/      typed content shapes
    src/lib/data/        content.json (single source of truth)
    src/lib/services/    content, auth, theme, scroll, motion
    src/lib/guards/      authGuard, guestGuard
    src/lib/schema/      content-schema, editor-draft, dotted-path helpers
  ui/                    @pc/ui — presentation building blocks
    src/lib/             icon, field, marquee, section-heading, aurora, cursor,
                         scroll-progress, back-to-top, side-rails, directives
  portfolio/             the application
    src/app/auth/        auth layout, login, register
    src/app/dashboard/   shell, section pages, editors
    src/app/portfolio/   public shell, sections, navbar, footer
```

Libraries are consumed through the `@pc/core` / `@pc/ui` path aliases pointing at **source**,
so the dev server hot-reloads library edits. Both are also independently buildable with
ng-packagr; because `ui` depends on `core`, `ng build ui` resolves `@pc/core` from `dist/core`
— run `npm run build:libs`, which builds them in order.

## How it is built

- **Full-width, container-driven layout.** The shell spans the viewport (`--shell: 100%`) and
  sections are `container-type: inline-size` query containers. Breakpoints are
  `@container page (...)` rather than viewport media queries, so a section responds to the space
  it actually has — which is what lets the same components render correctly inside the
  dashboard's centre pane. It also makes the responsive layout testable.
- **One content store.** `ContentService` holds the site as signals with
  add/update/move/remove, persistence and JSON import/export.
- **Zoneless + signals.** No `zone.js` in the bundle. Every component is `OnPush` and
  standalone.
- **One scroll listener.** `ScrollService` runs a single rAF-throttled listener feeding the
  progress rail, navbar state, active link and back-to-top button.
- **Animations are CSS, driven by directives.** `RevealDirective` only toggles a class; the
  transition is declared once against `[data-reveal]`. Tilt, magnetic hover and count-up write
  to the element inside an animation frame, never through bindings.
- **Theming.** Two token sets keyed off `<html data-theme>`; `ThemeService` persists the choice
  and falls back to the OS preference.
- **Reduced motion.** `MotionService` is the single answer to "may I animate?", and
  `styles.scss` neutralises transitions under `prefers-reduced-motion`.

## Layout breakpoints

| Breakpoint | What changes |
| --- | --- |
| 700px | Hero decoration tucks inside the card; timeline meta left-aligns |
| 720 / 1180px | Skill groups go 2 then 3 columns (six groups, so rows always fill) |
| 760 / 1180px | Projects go 2 then 3 columns; the lead project spans two tracks |
| 980px | Workspace sidebar becomes a drawer |
| 1040px | Section headings spread into title + lede columns |
| 1100px | Timeline cards split: bullets left, key project right |
| 1240px | About stats become a single-column rail beside the prose |
| 1400px | Public-site side rails appear and the gutter widens to clear them |

Viewport-relative type is tokenised as `--h1-size` / `--h2-size` so the layout tests can pin it
— `vw` units cannot follow a test wrapper.

## Tests

`npm run test:shop` runs 53 specs over the storefront:

- **bill maths** — item totals, MRP savings, percentage coupons capped at their ceiling, flat
  and free-delivery coupons, the free-delivery threshold, GST on the discounted goods value
  only, express surcharge, and that the total is the sum of its parts
- **cart** — variants as separate lines, the 20-per-line cap, refusing out-of-stock stock,
  coupons dropping when a cart falls below the minimum, persistence
- **catalog** — search across name, tags, category and kitchen; veg excluding egg; price
  ceilings; sorting; cheapest in-stock pricing
- **payments** — UPI intent format, Luhn, brand detection, expiry and CVV rules, sandbox
  capture, the `0000` decline, UPI staying pending until confirmed
- **orders** — placing, newest-first, stage advance stopping at delivered, attaching a payment
- **flow** — every route renders, guests redirected to sign in with the destination remembered,
  adding to cart from the product page, a cash order placed end to end

`npm run test:medicare` runs 38 specs over the hospital platform:

- **async state** — the loading / reloading / ready / empty / error states every screen renders
  through, an empty page envelope counting as empty, and a slow first response losing to the
  second one that overtook it
- **action state** — results returned, field errors captured rather than thrown, a second
  submit ignored while the first is in flight
- **errors** — the API envelope unwrapped, an unreachable server turned into an actionable
  message, blank query values dropped from filter URLs
- **interceptors** — the bearer token added to our own API only, the session dropped on a 401,
  and *kept* when it is the login call that was rejected
- **auth** — each role routed to its own panel, sign-out clearing everything
- **basket** — add / increment / remove, quantity clamped, a corrupt stored basket survived,
  and the quote request carrying ids and quantities but never a price
- **theme** — all six themes written to the document root and remembered, light/dark toggle,
  density
- **guards** — a visitor redirected with the destination remembered, a patient kept out of the
  doctor panel with `?denied`, a doctor kept out of the patient panel, a signed-in account sent
  away from sign-in, reception routed into the patient shell
- **screens** — the sign-in page listing the demo accounts the API reports, and explaining
  itself when the API is not running; the 404 page offering a way back
- **pipes** — Indian rupee grouping, clinic date and 12-hour clock formats, relative times,
  API enums as labels, initials

`npm run api:test` drives 51 checks against the **running** API rather than importing it, so
what is covered is what actually ships — booking and the 409 on a taken slot, the declined and
the successful payment paths, the whole consultation flow from opening to the written record,
℞-only blocking and coupons, QR access control, role isolation, dashboards, field-level
validation and the minor-guardian rule. It puts back everything it changes, so it can be run
repeatedly without reseeding.

`npm test` runs 45 specs over the portfolio:

- **auth** — registration, normalised emails, no password in storage, duplicate rejection,
  wrong-password rejection, identical error for unknown email, session restore
- **guards** — unauthenticated redirect, remembered destination, signed-in passthrough, public
  portfolio staying open
- **dashboard** — every section route renders, preview/edit tabs swap, add and delete flows
- **content store** — CRUD, reorder bounds, import/export round-trip, bad-file rejection,
  gap-filling, persistence and reset
- **schema** — every section points at a real branch; every list has a blank covering its
  required fields
- **draft** — dotted fields flatten and fold back, untouched keys survive, required-field
  reporting
- **layout** — 360px to 2560px: no overflow, column counts, timeline split, heading spread

## Before you publish

1. Drop your résumé PDF in `public/` as `Pradeep_Chauhan_Resume.pdf` — the download buttons
   point at it and will 404 until it exists.
2. Add a GitHub link if you want one: a new entry under **Contact links** in the workspace.

## Deploying

`npm run build` emits static files to `dist/portfolio/browser`. Any static host works. Add a
rewrite of all routes to `index.html` — `/login`, `/dashboard/*` and `/portfolio` all need it.
`content.json` is emitted at the site root so it can be edited on the host.
