---
name: Taskmaster
description: A dark, glass-surfaced control-room board tool with a slow animated aurora background, for solo founders and small teams
colors:
  bg: "hsl(240 8% 7%)"
  surface: "hsl(240 8% 10%)"
  surface-raised: "hsl(240 8% 13%)"
  ink: "hsl(0 0% 97%)"
  ink-muted: "hsl(240 5% 65%)"
  border: "hsl(240 6% 20%)"
  primary: "hsl(0 0% 96%)"
  secondary: "hsl(235 70% 62%)"
  accent: "hsl(190 55% 50%)"
  destructive: "hsl(0 72% 51%)"
  success: "hsl(150 55% 45%)"
  shader-1: "#07070a"
  shader-2: "#161217"
  shader-3: "dynamic — see Shader Palette below"
  shader-4: "#0e0e11"
typography:
  body:
    fontFamily: "Instrument Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "16px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "hsl(240 8% 7%)"
    rounded: "{rounded.md}"
    padding: "6px 14px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
---

# Design System: Taskmaster

## Overview

**Creative North Star: "Mission Control, Aurora"**

Taskmaster's surfaces float as frosted glass over a slow, living aurora — a dark animated mesh gradient (indigo/violet/deep-teal) that's the app's real background, everywhere, not a decorative flourish on one page. Structure still comes from hairline borders and tonal steps, and color is still spent deliberately (one confident CTA color, per-list dot identity, real per-label hex values) — but depth now comes from translucency and blur, not flat opaque tiles.

This supersedes the earlier "Mission Control, restrained" system, which was fully flat and opaque with blur reserved for the header alone. That system is now anti-reference, not current direction: read `git log` on this file if you need the reasoning trail, but don't reintroduce flat/opaque cards or a static background — that's the look this redesign deliberately left behind.

Two reference boards (`inspiration/trello1.png`, `inspiration/trello2.png`) anchor this direction: trello1 for structure and restraint (hairline borders, one dot per list, a bold single accent), trello2 for how bold and alive the background is allowed to be — a real, saturated, blurred gradient filling the scene, with UI surfaces reading as glass panels floating on top of it.

**Key Characteristics:**
- The animated mesh-gradient shader (see **Ambient Shader Background**) is the real page background everywhere — homepage, boards, settings, profile, search, login. Not a subtle texture; it should read.
- Cards, columns, modals, and dropdowns are frosted glass: semi-transparent surface color + backdrop blur, not opaque tiles. The gradient should be faintly visible through them.
- One confident primary accent — paper white on dark — reserved for CTAs, active states, and focus rings.
- List/column identity still comes from a small deterministic dot-color rotation, not a full-panel color wash.
- Controls (buttons, inputs, nav items) stay compact — 14px text, tight padding — the glass treatment doesn't mean oversized or decorative controls.
- Instrument Sans throughout — warmer and more contemporary than the previous Inter, still compact at small UI sizes.

## Colors

Color is still spent deliberately for UI state (CTAs, list dots, status), but the background itself is now a living gradient rather than a flat void — the "quiet neutral field" job moved from a solid color to the shader.

### Primary
- **Paper White** (`hsl(0 0% 96%)`): the one confident UI accent. Primary buttons, active nav/tab state, focus rings, the "you are here" signal. Used sparingly — never as a full-surface wash.

### Secondary
- **Indigo** (`hsl(235 70% 62%)`): links, secondary emphasis, one of the rotating list-accent dot colors, and one of the shader's mesh colors.

### Tertiary
- **Teal** (`hsl(190 55% 50%)`): one of the rotating list-accent dot colors; sparing use elsewhere; also echoed in the shader palette.

### Neutral
- **Void** (`hsl(240 8% 7%)`): `<body>`'s fallback color for the instant before the shader canvas mounts. Not the visible background once the app has loaded.
- **Surface** (`hsl(240 8% 10%)`): the base tone for cards/columns/modals, always used at reduced opacity (`/60`–`/90`) with `backdrop-blur`, never fully opaque.
- **Surface Raised** (`hsl(240 8% 13%)`): popovers, dropdowns — one step up, also glass (`/85`–`/95` + blur).
- **Hairline** (`hsl(240 6% 20%)`): all borders. Always 1px, always this color (or a lower-alpha variant) — never a colored border unless signaling active/drop-target state.
- **Ink** (`hsl(0 0% 97%)`): primary text.
- **Ink Muted** (`hsl(240 5% 65%)`): secondary text, timestamps, placeholders. Contrast was verified against opaque Surface; re-check against the glass/shader combination if a specific spot looks weak, since a translucent surface's effective contrast depends on what's showing through it.

### Shader Palette
- **Shader Ink** (`#07070a`), **Shader Graphite** (`#161217`), **Shader Void** (`#0e0e11`): three of the four mesh-gradient colors — fixed, dark, neutral charcoal/graphite tones.
- **Shader Drift** (dynamic): the fourth color is generated, not fixed — a dark, low-saturation hue (`hsl(<time-based hue> 35% 11%)`) that changes every 20 minutes, deterministically derived from the current time (golden-angle hue increment per 20-minute bucket — same window always gives the same color, so it never glitches mid-session, only drifts across them). Replaced an earlier fixed plum undertone, which read as dull, and a fixed teal that followed it, which read as too green. Always stays dark/desaturated — the point is a slow ambient drift, not a visible color-of-the-moment callout. See **Ambient Shader Background**.

### Named Rules
**The One Accent Rule.** Paper White appears on primary buttons, active states, and focus rings only. It never fills a whole card, column, or panel — that job belongs to a 1px border or a small dot, never a background wash.

**The Real Label Color Rule.** Card label colors come from the database (`labels.color`), rendered as-is. Do not theme-ify them; they are user data, not system tokens.

**The Glass Surface Rule.** Every UI surface that used to be flat/opaque Surface or Surface Raised is now that same color at partial opacity + `backdrop-blur`. Modals and dropdowns with dense text get higher opacity (`/90`–`/95`) for legibility; kanban cards and columns can sit lower (`/60`–`/75`) since the aurora showing through is part of the intended look.

## Typography

**Body Font:** Instrument Sans (with -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif fallback)

**Character:** A modern grotesk with a bit more personality than Inter's utilitarian read — slightly warmer letterforms, still compact at small UI sizes. Chosen for a more contemporary, less spreadsheet-like feel that pairs with the animated background, without going oversized or decorative; controls should still look correctly sized, not blown up.

### Hierarchy
- **Title** (600, 1.125rem–1.25rem, 1.3): board name, modal titles.
- **Body** (400–500, 0.875rem, 1.5): card titles, list names, body copy.
- **Control** (500, 0.875rem/14px): buttons, inputs, nav items — compact padding (`py-1.5`–`py-2`, `px-3`–`px-3.5`), not the oversized `py-2.5`+ scale.
- **Label** (500, 0.75rem, uppercase optional for section labels only — not used as a per-section eyebrow decoration): metadata, counts, timestamps.

## Layout

Board view is a horizontal scroll of fixed-width columns (`w-80`) with comfortable internal padding (16px). Cards get room to breathe (12px internal padding, 8–12px gaps) without controls (buttons, inputs, badges) ballooning past their compact 14px/tight-padding sizing.

## Elevation & Depth

**The Glass-By-Default Rule.** Every floating or content surface (cards, columns, modals, dropdowns, the header) is translucent Surface/Surface Raised + `backdrop-blur`, letting the animated shader read faintly through it. This replaces the old flat/opaque, blur-only-on-header system. Depth now comes from three things together: the blur itself, tonal opacity steps, and 1px hairline borders — not box-shadow glow. Modals/popovers keep a single neutral shadow (`0 8px 30px rgba(0,0,0,0.35)`) on top of the glass for legibility against whatever's behind them — never a colored/tinted shadow.

### Shadow Vocabulary
- **Modal / Popover** (`box-shadow: 0 8px 30px rgba(0,0,0,0.35)`): neutral black shadow, layered on top of the glass surface for floating content that must read above whatever's behind it.

## Shapes

Corners are gently rounded, not sharp and not pill-heavy: 10px on inputs, 14px on kanban columns and small modals, 16px on the redesigned homepage board cards, full-round only on avatars, dot indicators, and true pill badges (label chips, counters). Borders are always 1px hairline in the border token — no 2px+ decorative borders, no colored side-stripes.

## Components

### Buttons
- **Shape:** 10px radius, compact padding (`px-3.5 py-1.5`, 14px text) — not oversized.
- **Primary:** Paper White background, near-black text, no gradient. Hover darkens slightly (`/90` opacity swap); no scale/glow.
- **Secondary / Outline:** transparent background, hairline border, ink-muted text; hover raises text to ink and border to primary.
- **Ghost:** no border, ink-muted text; hover gets a faint surface-raised background.

### Cards (kanban task cards)
- **Corner Style:** 10px.
- **Background:** `bg-card/75` + `backdrop-blur-xl` — glass, not opaque, not a translucent white overlay.
- **Border:** 1px hairline at rest; primary at 40–70% opacity only while an active drag target.
- **Shadow Strategy:** none at rest. A drag-lift state may use the one neutral modal shadow.
- **Hover:** border shifts toward a lighter neutral, surface opacity nudges up (`/75` → `/85`), a subtle 2px rise — no lift theatrics beyond that.

### Board Cards (homepage board tiles)
- **Corner Style:** 16px, taller than kanban cards (`h-40`) to hold a name, star, and last-updated timestamp.
- **Background:** `bg-card/70` + `backdrop-blur-xl`, flat — no color-glow blob (removed; read as visual noise) and not the old 1.5px top color bar. The small color dot next to the board name (see below) is the only per-board color identity now.
- **Hover:** lift (`-translate-y-1`), border and surface opacity both increase, neutral shadow appears.
- **One shared component, everywhere:** every board-tile grid (homepage Starred/Recent, homepage per-workspace sections, the `/boards/[workspace]` listing, `/starred`) renders this exact treatment — `BoardCard` on the homepage/starred page, `WorkspaceBoardCard` on the workspace listing (kept separate only because it also carries description text and custom-hex-color support, memoized for large lists). If a board grid ever looks different from this spec, that's drift to fix, not a second design to maintain.

### Headings
- **Entrance:** primary page/section headings (app wordmark, board name, homepage section titles like "Recent Boards") get a one-time `.heading-enter` animation on mount (`globals.css`) — a gentle 8px rise with a fade, ~0.7s, not a continuous or looping effect. It fires once when the element mounts, never on every re-render or hover.

### Columns (kanban lists)
- **Corner Style:** 14px.
- **Background:** `bg-card/60` + `backdrop-blur-xl` — glass, flat color otherwise, no gradient wash of its own.
- **List identity:** a small colored dot next to the list name, assigned deterministically from the list id across a rotation of Indigo / Teal / Rose / Amber / Slate. The dot is the only per-list color; the column body stays neutral Surface (now translucent).

### Chips / Label Pills
- **Style:** background = the label's real stored color; text color computed for contrast (existing luminance check preserved). No system-wide recoloring of user label data.

### Inputs / Fields
- **Style:** Surface background, hairline border, 10px radius. Inputs stay solid/opaque (not glass) — legibility while typing matters more than seeing the shader through a text field.
- **Focus:** border becomes primary, plus a 2px primary/30 ring — no extra glow beyond the ring.

### Navigation / Header
- **Style:** fixed header at `bg-background/90` + `backdrop-blur-lg` — no longer the *only* blur surface in the app, but still the highest-opacity one since it needs to stay legible while content scrolls underneath it. Logo is a solid ink wordmark, not a gradient-clip-text effect; active tab/filter gets a 2px primary underline and primary text color.

### Dropdowns, Menus, Expanding Forms
- **Open:** every dropdown, popover menu, and inline expanding form (list/card actions menus, header create/search/profile dropdowns, add-list/add-card forms, modal mount) gets a quick, subtle entrance: `animate-in fade-in-0 zoom-in-95 duration-150` for menus/dropdowns, `animate-in fade-in-0 slide-in-from-top-1 duration-150` for inline expanding forms, `animate-in fade-in-50 zoom-in-95 duration-200` for larger modals (slightly slower since there's more surface to settle). Uses the `tailwindcss-animate` plugin (`tailwind.config.js`) — don't reference `animate-in`/`fade-in-*`/`zoom-in-*` classes without confirming that plugin is still registered.
- **Close:** instant, no exit animation. These components close by unmounting (`{isOpen && <div>...}`); don't add `animate-out` or exit transitions.

### Ambient Shader Background
- **What:** a `MeshGradient` (`@paper-design/shaders-react`) using the four Shader Palette colors, low distortion (0.55) and swirl (0.2), slow speed (0.25) — visibly animated but subtle and unhurried, dark enough to sit behind content without fighting for attention.
- **Where:** mounted once, globally, in the root layout (`app/layout.tsx`), `fixed inset-0 -z-10`, behind every page. Not re-mounted per page or per card — one canvas for the whole app, both for consistency and to avoid the real performance cost of multiple simultaneous WebGL canvases.
- **Component:** `app/components/ui/MeshBackground.tsx`.
- **Don't:** mount a second/duplicate shader instance per page or per card (real perf cost, and it breaks the "one continuous scene" feel), don't brighten it into pure decoration that competes with foreground content, don't introduce a second unrelated shader elsewhere without updating this section first.

## Do's and Don'ts

### Do:
- **Do** let the animated shader be the app's real background everywhere, at a visible, moving strength — not a faint static texture.
- **Do** make floating/content surfaces translucent + blurred (glass) so the shader reads through them.
- **Do** reserve Paper White for the one confident CTA/active-state role; everything else stays neutral.
- **Do** use 1px hairline borders as a structural device, even on glass surfaces.
- **Do** let real label colors from the database render unmodified.
- **Do** keep controls (buttons, inputs, nav items) at compact 14px text and tight padding — glass surfaces don't mean oversized controls.

### Don't:
- **Don't** apply a colored box-shadow glow to cards, buttons, or badges at rest (the neutral modal shadow is the one exception, for legibility).
- **Don't** use `white/5` / `white/10` translucent overlays as a substitute for real surface tokens — style against Void/Surface/Surface Raised (at whatever opacity the component calls for) directly.
- **Don't** wash an entire column or card background in a per-list accent color; the dot carries identity, the surface stays neutral (glass) Surface.
- **Don't** use decorative gradients on buttons, text, or avatars — the one gradient in this system is the ambient shader background, nowhere else.
- **Don't** mount more than one live shader canvas at a time (see **Ambient Shader Background**).
