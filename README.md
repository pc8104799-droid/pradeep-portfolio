# Angular 22 monorepo

Two applications and three libraries in one workspace:

- **Portfolio** — a public portfolio plus a signed-in workspace for editing every part of it.
- **FreshKart** — a food and grocery storefront: browse, cart, coupons, checkout, UPI / card /
  cash payment, and order tracking.

Zoneless, signal-based, no UI library, no icon font, no animation library — every component,
icon and animation here is hand-written.

## Run it

```bash
git clone https://github.com/pc8104799-droid/pradeep-portfolio.git
cd pradeep-portfolio
npm install

npm start              # portfolio  -> http://localhost:4200
npm run start:shop     # FreshKart  -> http://localhost:4200

npm run build          # portfolio -> dist/portfolio
npm run build:shop     # FreshKart -> dist/shop
npm run build:libs     # libraries -> dist/core, dist/ui, dist/shop-core
npm run build:all      # libraries then both apps

npm test               # portfolio: 45 specs
npm run test:shop      # FreshKart: 53 specs
```

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

## The three areas

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
projects/
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
