# Estelleo

Personal art portfolio for the artist Estelleo. Single-author project. Soft pink aesthetic, white rounded cards, minimal UI, image-first.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (`@tailwindcss/postcss`)
- **Framer Motion** for all animations (`motion`, `AnimatePresence`, `layoutId`)
- **Lenis** for smooth scroll (initialized in `app/page.tsx`)
- **Sharp** server-side for image metadata (dominant color + blur placeholder)
- JSON files in `data/` as the database — no real DB

## Routes

- `/` — the public site (`app/page.tsx`). Hero, featured marquee, gallery masonry, lightbox carousel, collection filter.
- `/orin` — admin panel (`app/orin/page.tsx`). Password-gated. Three tabs: Gallery / Featured / Collections.
- `/wormhole` — decorative canvas effect page (`app/wormhole/page.tsx`).
- `/gallery` — exists as directory but empty; treat as unused.

## API routes (`app/api/`)

- `GET /api/images?type=all|featured` — returns list of image filenames from `public/imgs/` or `public/imgs/featured/`.
- `GET /api/data` — returns `data/images.json`. Backfills missing `color` + `blurDataUrl` using Sharp on first read.
- `POST /api/data` — overwrites `data/images.json` with the request body.
- `POST /api/upload` — multipart upload to `public/imgs/` or `public/imgs/featured/` based on `type` field.
- `POST /api/delete` — deletes a file from disk and from `data/images.json`.
- `GET /api/collections` — returns `data/collections.json`.
- `POST /api/collections` — overwrites the collections list.

## Data shapes

`data/images.json` — object keyed by image filename:
```ts
{
  [filename: string]: {
    title?: string;
    description?: string;
    date?: string;          // human string, e.g. "September 2024"
    order?: number;
    color?: string;         // "rgb(r,g,b)" dominant color
    blurDataUrl?: string;   // base64 data URL for progressive load
    collections?: string[]; // array of collection ids
  }
}
```

`data/collections.json` — array:
```ts
Array<{ id: string; name: string; order: number }>
```

## Admin panel (`/orin`)

- **Password**: `shyabid00` (hardcoded in `app/orin/page.tsx`, not secure — treat this as a toy gate).
- Tabs:
  - **Gallery** — manage public gallery images. Upload, edit title/description/date, reorder, delete, **assign collections** via `+tag` popover (multi-select).
  - **Featured** — same UI, targets `public/imgs/featured/` (the homepage marquee).
  - **Collections** — create / rename (click pill) / reorder / delete collections. Deleting a collection strips its id from every image.
- Admin has its own filter pill row to filter the gallery grid by collection.

## Homepage structure (`app/page.tsx`)

1. Hero block — white rounded card with emoji + "ESTELLEO" + meta line.
2. Featured marquee — infinite horizontal scroll of `public/imgs/featured/*`, scroll-velocity-reactive, pauses on hover.
3. Commissions footer block — "DM me at @estelleo in discord".
4. **Collection filter pill row** — hidden if no collections exist. Active pill uses framer `layoutId="home-filter-active"` for the sliding white capsule.
5. Gallery masonry (CSS columns) — filtered by `activeFilter`. Click opens the lightbox.
6. Lightbox carousel — 5-image window (offsets -2…+2), CSS transitions for sliding, framer `AnimatePresence` for enter/exit + description crossfade.

## Key conventions & gotchas

- **Shared ease**: `const SMOOTH_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]` in `app/page.tsx`. Use this for any new animations on the homepage for a consistent feel.
- **Lenis scroll**: access via `lenisRef.current`. To stop/start (e.g. when a modal opens) use `lenisRef.current?.stop()` / `.start()`. Also set `document.body.style.overflow`.
- **Filter reflow scroll-guard**: when `activeFilter` changes and the page shrinks, an effect measures `documentHeight - viewportHeight` over multiple rAF/timeouts and smoothly scrolls up via Lenis if the user is now past the end. Preserve this behavior if you touch the filter logic.
- **Lightbox navigation**: there are **invisible full-height side click zones** (`z-[35]`, 20% width on left and right) inside the lightbox that always trigger `prev`/`next`. They exist because the side preview images are mid-animation after a click and their hit targets move with the slide. **Don't remove these** — the user explicitly wanted rapid side-clicks to always work even during the slide animation.
- **No visible arrow buttons** in the lightbox on purpose — the user removed them in favor of the side click zones. Don't add them back without being asked.
- **CSS columns + framer layout don't mesh**: the gallery masonry uses `columns-2 md:columns-3 …`. Per-tile `layout`/`popLayout` animations look janky because CSS columns reflow instantly. The working pattern is `<AnimatePresence mode="wait">` with a `motion.div` keyed on `activeFilter` — the **whole grid crossfades** instead of individual tiles. If you ever switch to grid/flex, you can revisit tile-level layout animations.
- **Featured marquee animation** lives in a `requestAnimationFrame` loop that reads `scrollVelocity.current` (set via a Lenis `scroll` listener). If you move marquee logic, remember to keep the scroll hook.
- **ProgressiveImage** (`components/ProgressiveImage.tsx`) takes `placeholderColor` and `blurDataUrl` from `imageDescriptions[filename]` — both are backfilled by `/api/data` GET using Sharp, so the first GET after adding new images is slow but self-healing.
- **Global CSS rules in `app/globals.css`**:
  - `user-select: none`, `-webkit-user-drag: none` everywhere — images aren't selectable or draggable, text isn't selectable. This was an explicit request; don't re-enable it.
  - Scrollbars hidden across Chrome/Firefox/Edge (`::-webkit-scrollbar { width: 0 }` + `scrollbar-width: none`). Don't add back scrollbars without asking.

## Design direction

- Soft pink base (`bg-pink-100/90`), white rounded cards with big `rounded-[3vh] md:rounded-[5vh]` corners.
- Minimal, personal, contentful. Avoid generic portfolio-template energy.
- Pills and CTAs: white capsule with black text for active, muted for inactive, no hover effects, no shadows, no borders on the active pill. Keep it clean.
- Animations should feel **smooth and intentional**, not bouncy. Prefer tween/ease-out over spring. Spring bounce on `whileTap` tends to cause text wiggles — use `transition={{ type: "tween", duration: 0.12, ease: "easeOut" }}` for taps on elements that contain text.

## Working with this repo

- Type check: `npx tsc --noEmit` (has been clean). There is no test suite.
- `npm run dev` to run locally. Data JSON lives on disk so dev-mode edits persist across reloads.
- When editing animations, always reuse `SMOOTH_EASE` and keep durations in the 350–900ms range for section-level transitions; 120–350ms for clicks.
- When touching the lightbox, test rapid side-clicks, keyboard arrows, wheel scroll, and `Escape`.
- When touching the gallery filter, test: filtering to a small set while scrolled near the bottom (scroll-guard), and full-grid fade-through (no CSS column snap).

## User preferences (learned)

- Wants fast iteration and concrete actions, not long planning docs. Present a compact design, get one approval, implement.
- Rejects generic UI. Prefers minimal, editorial, personal touches.
- Very specific about small details (text color, wiggle on tap, border/shadow presence). Read their feedback literally and make only the change asked — no speculative "improvements".
- Will revert aggressively if a change overshoots the ask. Prefer smaller, reversible steps.
