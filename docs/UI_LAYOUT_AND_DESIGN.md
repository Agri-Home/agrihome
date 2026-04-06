# AgriHome UI layout and design principles

This document describes the current application shell, page structure, visual language, and the reasoning encoded in the codebase. It reflects the Next.js App Router UI under `src/app` and shared components under `src/components`.

## High-level layout

### Root layout

- **`src/app/layout.tsx`** loads **DM Sans** as `--font-app`, applies global styles, and wraps all routes in **`PwaProvider`** (service worker + install context) and **`AppShell`**.
- **Viewport** is mobile-first: `device-width`, `initialScale: 1`, `maximumScale: 1`, `viewportFit: cover` for notched devices. **Theme color** is moss green (`#1a3d2e`) for the browser/PWA chrome.

### App shell (`AppShell`)

The shell is responsible for navigation, width constraints, and ambient background—not individual pages.

| Region | Behavior |
|--------|----------|
| **Page background** | Full-height column on `bg-canvas`. A fixed, non-interactive layer (`pointer-events-none`, `z-[-10]`) holds large blurred blobs: lime, leaf, and ember tints for depth without clutter. |
| **Content column** | `max-w-lg` on small screens, expanding to `lg:max-w-6xl` with a **sidebar + main** split from `lg` breakpoint upward. |
| **Desktop sidebar** | Hidden below `lg`. Fixed width `w-56`, vertical gradient `ink → moss → dark green`. Brand row: **lime** app icon tile + **AgriHome** wordmark. Nav lists the same five routes as mobile with **inline SVG icons**; **lime pill** + shadow for the active row, muted white/70 with hover wash for inactive. |
| **Main** | `flex-1` scroll area with horizontal padding (`px-4` → `lg:px-8`), top padding with **`safe-top`**, and **extra bottom padding on mobile** (`pb-28`) so content clears the elevated bottom bar and FAB. |
| **Mobile bottom nav** | Fixed bar (`z-30`) with `safe-bottom`, frosted surface (`bg-white/92`, `backdrop-blur-2xl`), subtle top border and dock shadow. Each item is **icon + label** (`text-[10px]`). **Active** routes use **leaf** text and a **lime-tinted rounded icon well**; inactive items are `text-ink/40` with a light hover wash. **Add Plant** is a **FAB**: raised `-mt-6` circular-tile button (`shadow-fab` from Tailwind), **leaf** or **leaf→moss** gradient, plus label beneath. |

**Navigation items** (order): **Dashboard** (`/`), **Trays** (matches `/trays` and `/plants/*` except `/plants/new`), **Add Plant** (`/plants/new`, FAB on mobile), **Mesh** (`/mesh`), **Schedule** (`/schedule`). Tray-related routing groups plant detail under “Trays” for one mental model.

### Page composition (typical pattern)

Most routes render a single top-level `<div>` inside `main` with:

1. Optional **`BackLink`** (`←` + label) for hierarchy (e.g. tray detail → trays index).
2. **Page title** (`h1`)—often a **moss→leaf gradient** clipped to text on marketing-style headers, or plain `text-ink` on directory pages.
3. **Subtitle / meta** in `text-sm text-ink/45`.
4. **Content blocks**: cards, charts, lists, `dl` grids for key-value stats.

There is no shared “page header” component; repetition is intentional and lightweight, with **`PanelHeader`** available for richer sections (eyebrow, title, description, action).

---

## Visual language and design principles

### 1. Nature-forward, calm canvas

- **Base canvas** (`--canvas` / `canvas` token): warm off-white (`#faf9f5`), not pure gray—reads as paper or greenhouse light.
- **Body** layers subtle **radial gradients** (lime and leaf) and a vertical wash in `globals.css` so the app feels **spatial** even before content loads.
- **Foreground** is deep green-black (`ink` / `--foreground`) for high legibility without harsh pure black.

*Principle:* The UI should feel like a **growing environment** (greens, warmth, soft light), not a generic admin dashboard.

### 2. Glass and layered surfaces

- **`glass-panel`** (atoms `Card`): semi-transparent white, blur, soft shadow, light border. Hover lifts slightly with a **spring** easing (`cubic-bezier(0.34, 1.2, 0.64, 1)`), also exposed in Tailwind as `ease-spring`.
- **App `Card`** (`components/app/Section.tsx`): alternate surface—**gradient fill** white→hint of lime, **ring**, **border** `leaf/15`, smaller radius on mobile (`rounded-2xl`) vs hero cards (`rounded-3xl` / `md:rounded-[1.85rem]` on atoms `Card`).

*Principle:* **Depth through translucency and shadow**, not heavy outlines. Two card styles separate **dense lists** (app `Card`) from **hero / metric** panels (atoms `Card` + `glass-panel`).

### 3. Accent hierarchy

| Role | Token / usage |
|------|----------------|
| Primary accent | **Lime** (`#c8fb80`)—active nav, success badges, highlights. |
| Structural / links | **Leaf** (`#3d9f6c`)—secondary actions, borders, mobile tab active state. |
| Dark UI / primary buttons | **Ink** / **Moss**—sidebar, dark inset panels (e.g. hero snapshot column). |
| Alert / warmth | **Ember**—ambient blob only in shell; badges use amber/rose for warning/critical. |

CSS variables in `:root` mirror Tailwind for non-Tailwind contexts (`--accent`, `--accent-deep`, `--border`, etc.).

*Principle:* **One loud accent (lime)** for “you are here” and positive state; **leaf** for interactive affordances; **ink/moss** for authority and contrast blocks.

### 4. Typography

- **DM Sans** everywhere via `font-sans` / `--font-app`.
- **Titles:** `font-semibold` / `font-bold`, often `tracking-tight` on page titles; **section labels** use `uppercase`, `tracking-wider` or `tracking-[0.2em]`–`[0.3em]` for a **small-caps / lab label** feel (`SectionTitle`, `PanelHeader`, `MetricTile`).
- **`.panel-title`** utility: `font-weight: 600`, `letter-spacing: -0.02em` for display headings.

*Principle:* **Readable, friendly geometry** (sans) with **precision cues** in uppercase micro-labels—appropriate for monitoring and hardware contexts.

### 5. Motion and accessibility

- **Reduced motion:** `prefers-reduced-motion` disables smooth scroll, collapses animations/transitions to negligible duration, and stills `.animate-surface-shimmer`.
- **Focus:** `.focus-ring:focus-visible` uses `--accent-deep` (leaf); buttons use `focus-visible:outline` on **leaf**.
- **Touch:** `touch-action: manipulation`, no tap highlight flash, `overscroll-behavior-y: contain` on `body` for app-like scrolling.

*Principle:* Polish **without** sacrificing **WCAG-friendly** focus and vestibular safety.

### 6. Mobile-first PWA

- Bottom navigation + **FAB** for the highest-frequency create action + safe areas + `maximumScale: 1` imply **installed-app behavior** and layout stability on phones.
- Service worker registration lives in **`PwaProvider`**.

*Principle:* **Phone is the primary remote** for the greenhouse; desktop is an expanded viewport with persistent sidebar.

---

## Component map (UI-relevant)

| Layer | Examples |
|-------|----------|
| Shell | `AppShell`, `PwaProvider` |
| Atoms | `Button` (primary / secondary / ghost), `Badge` (default / success / warning / critical), `Card` (`glass-panel`), `StatusDot` (plant/tray status with optional pulse) |
| App helpers | `SectionTitle`, `Card` (list-style), `BackLink` |
| Molecules | `PanelHeader`, `MetricTile` |
| Organisms | `src/components/organisms/*` — **panel layouts** (`DashboardHero`, `LiveCameraPanel`, etc.); not imported by current App Router pages (live screens compose atoms + `Section` + charts directly) |
| Charts | `ClientChartFrame`, bar/line/area chart components |

### Buttons

- **Primary:** ink background, white text, lift shadow; hover shifts to moss and optional glow.
- **Secondary:** strong surface, border; hover picks up leaf border tint.
- **Ghost:** minimal; hover uses ink at low alpha.
- Shared: `rounded-2xl`, `active:scale-[0.97]`, spring-friendly transitions.

### Badges

- Pill shape, uppercase, small type; **tone** maps to semantic status (success = lime/moss/leaf rings; warning/critical = warm reds/ambers).

### Charts and media

- Charts are wrapped in **`ClientChartFrame`** with skeleton placeholders (e.g. gradient pulse) to avoid layout shift.
- Imagery uses **`next/image`** with responsive `sizes` where specified.

---

## Information architecture (routes)

| Path | Role |
|------|------|
| `/` | Overview: tray count, optional health chart, latest camera frame, tray shortlist. |
| `/trays` | Full tray directory. |
| `/trays/[trayId]` | Tray detail: back link, stats grid, camera, plants, charts, vision analyze client. |
| `/plants/[plantId]` | Plant detail: server-rendered header, stats, latest finding, charts, reports, log; **client** block for photo, edit, delete (`PlantDetailClient`). |
| `/plants/new` | Add plant flow. |
| `/mesh` | Mesh listing / creation. |
| `/schedule` | Schedule UI (client). |

---

## When to use which `Card`

- **`@/components/app/Section` `Card`:** default for **list rows**, compact blocks, tray/plant index rows—lighter, list-friendly padding, gradient “panel” look.
- **`@/components/atoms/Card`:** **large panels**, metrics, hero sections—`glass-panel`, larger radius, stronger hover lift.

---

## Files of reference

- Global tokens and utilities: `src/app/globals.css`
- Tailwind extensions: `tailwind.config.ts` (includes `shadow-fab` for FAB / upload tiles)
- Shell layout: `src/components/shell/AppShell.tsx`
- Root layout: `src/app/layout.tsx`
- Implementation / API narrative: `docs/IMPLEMENTATION_GUIDE.md`

This document should be updated when navigation, breakpoints, or the dual `Card` pattern changes.
