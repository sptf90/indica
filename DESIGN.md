---
name: GoIndica
description: Cream/peach neighborhood marketplace for local indications — dense Operate workspace, not a rebrand.
colors:
  brand: "#fd5322"
  brand-deep: "#f04718"
  brand-soft: "#fff1ea"
  brand-mid: "#ffd8c6"
  peach: "#fff6ef"
  peach-deep: "#ffe8d8"
  cream: "#fbfaf7"
  cream-deep: "#f3ebe4"
  ink: "#1c1917"
  muted: "#6b6560"
  line: "#ece7e1"
  card: "#ffffff"
  ok: "#15803d"
  ok-bg: "#e9f9ef"
  info: "#2563eb"
  info-bg: "#e8f1ff"
  warn: "#9a3412"
  bad: "#991b1b"
  gold: "#ca8a04"
  purple: "#7c3aed"
typography:
  display:
    fontFamily: "Sora, Segoe UI, sans-serif"
    fontSize: "1.85rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Sora, Segoe UI, sans-serif"
    fontSize: "1.6rem"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-0.038em"
  title:
    fontFamily: "Sora, Segoe UI, sans-serif"
    fontSize: "1.1rem"
    fontWeight: 700
    lineHeight: 1.28
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Plus Jakarta Sans, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0em"
  label:
    fontFamily: "Plus Jakarta Sans, Segoe UI, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.01em"
rounded:
  field: "12px"
  card: "14px"
  radius: "16px"
  hero: "18px"
  pill: "999px"
spacing:
  page-pad-y: "0.65rem"
  page-pad-x: "1.35rem"
  page-pad-bottom: "1.6rem"
  hero-gap: "0.7rem"
  section-gap: "0.7rem"
  card-gap: "0.6rem"
  card-pad-y: "0.85rem"
  card-pad-x: "1rem"
  topbar-pad-y: "0.55rem"
  topbar-pad-x: "1.25rem"
  content-max: "72rem"
  content-max-wide: "84rem"
  sidebar-w: "248px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0.78rem 1.35rem"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0.78rem 1.35rem"
  button-outline:
    backgroundColor: "rgba(255, 255, 255, 0.92)"
    textColor: "{colors.brand}"
    rounded: "{rounded.pill}"
    padding: "0.78rem 1.35rem"
    typography: "{typography.label}"
  button-outline-hover:
    backgroundColor: "{colors.card}"
    textColor: "{colors.brand}"
    rounded: "{rounded.pill}"
    padding: "0.78rem 1.35rem"
  button-ghost:
    backgroundColor: "{colors.card}"
    textColor: "{colors.brand-deep}"
    rounded: "{rounded.pill}"
    padding: "0.55rem 1rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "0.85rem 1rem 0.85rem"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "0.7rem 0.8rem"
  chip:
    backgroundColor: "rgba(255, 255, 255, 0.82)"
    textColor: "{colors.brand-deep}"
    rounded: "{rounded.pill}"
    padding: "0.32rem 0.65rem"
  flow-hero:
    backgroundColor: "{colors.peach}"
    textColor: "{colors.ink}"
    rounded: "{rounded.hero}"
    padding: "0.85rem 1rem 0.85rem 1.1rem"
  sidebar-link-active:
    backgroundColor: "{colors.brand-soft}"
    textColor: "{colors.brand}"
    rounded: "{rounded.field}"
    padding: "0.68rem 0.8rem"
---

# Design System: GoIndica

## Overview

**Creative North Star: "Cream/Peach Neighborhood Marketplace Density"**

GoIndica is an Operate-mode productive app: a local indication marketplace that people work in, not a campaign they visit. The incumbent world is a warm cream/peach neighborhood shop — paper-cream canvas, peach hero washes, a single citrus-orange brand voice, Sora for display, Plus Jakarta Sans for UI — packed at auth-workspace density. Brand lives in precise details (pill CTAs, selected nav, status chips), not in full-bleed marketing color.

This file records the shipped `:root` system in `app/globals.css` and the shared shell/flow primitives. It does not invent a new identity. Page-local copies (`pedir-hero`, `admin-hero`, `emp-hero`, and sibling page heroes) currently fork the same peach language; they should converge onto the shared tokens and `flow-hero` / card / pill patterns rather than keep private hex and padding.

**Key Characteristics:**
- Cream canvas (`--cream`) with white cards and peach hero panels
- One accent: `--brand` / `--brand-deep`; semantic green/blue/red are status only
- Sora for titles, Plus Jakarta Sans for body and chrome
- Pill primary actions (`--radius-pill`) and 16px surface radius (`--radius`)
- Dense auth workspace: `--content-max` 72rem, tight `--page-pad` / `--section-gap` / `--card-gap`
- Sidebar + frosted topbar shell; flow-hero as the in-app page intro

## Colors

Warm paper neighborhood: cream ground, peach atmosphere, white work surfaces, stone ink, and a single orange accent used for identity and action.

### Primary
- **Brand**: Product accent for links, selected nav, pill CTAs, focus rings, and highlighted title words. Rarity is the point — it should not flood a screen.
- **Brand Deep**: Pressed/hover-adjacent ink on outline chips and ghost CTAs; reads as the same orange, one step darker.
- **Brand Soft**: Selected sidebar, notification hover, and tinted selected states. The wash behind brand, never a second accent.
- **Brand Mid**: Intermediate peach-orange fill when a stronger soft wash is needed (badges, spots). Stay inside this family.

### Neutral
- **Peach** / **Peach Deep**: Hero and illustration-panel atmosphere. Peach is a surface, not a second brand.
- **Cream** / **Cream Deep**: App canvas and recessed chips (CNPJ/count badges). Workspace body sits on cream with a faint brand radial at the top-right.
- **Ink**: Primary text.
- **Muted**: Leads, meta, timestamps, helper copy.
- **Line**: Hairline borders and the topbar rule.
- **Card**: White work surfaces.
- **Ok / Info / Warn / Bad / Gold / Purple**: Status only (chips, alerts, reputation traffic-light). They never replace Brand as the product accent.

### Named Rules
**The Token Authority Rule.** New UI consumes `:root` (`--brand`, `--peach`, `--cream`, `--line`, `--radius`, `--hero-pad`, `--card-pad`). Do not introduce a parallel hex (including `#ec5e27`) when `--brand` already exists.

**The One Accent Rule.** Chromatic action and identity are Brand. Semantic colors mark state. Peach and cream are atmosphere, not extra accents.

## Typography

**Display Font:** Sora (with Segoe UI, sans-serif) — `--font-display`, loaded via `next/font/google`
**Body Font:** Plus Jakarta Sans (with Segoe UI, sans-serif) — `--font-sans`
**Root size:** 15px (`--root-font-size`); sidebar chrome locks to 16px (`--sidebar-rem`) so nav does not shrink with the densified root

**Character:** Sora is tight, slightly geometric, and used for page and card titles. Plus Jakarta Sans carries the dense workspace — labels, leads, nav, buttons. No third display face.

### Hierarchy
- **Display** (700, `1.85rem` / `--type-display`, line-height 1.15, tracking −0.03em): Dashboard `h1` / `dash-question`. Fixed rem (Operate), not clamp.
- **Headline** (750, `1.6rem` / `--type-hero`, tracking −0.038em): `flow-title`, `pedir-title`, `indicar-title` — in-app page intro. Compact Operate headers use `--type-hero-compact` (`1.35rem`).
- **Title** (700, 1.15rem `h2` / ~1.02rem card titles, tracking −0.025em): Section and card headings in Sora.
- **Body** (400, 1rem at the 15px root, line-height 1.45–1.55): UI copy in Plus Jakarta Sans. Leads at 0.9rem, muted, max ~40–48ch on heroes.
- **Label** (650, 0.9rem, tracking −0.01em): Pill CTAs, sidebar links (500/650), form labels (600 at 0.92rem). Status chips go smaller (0.72–0.78rem, 700).

### Named Rules
**The Two-Family Rule.** Sora for display and titles; Plus Jakarta Sans for everything else. Do not add a third family for a single surface.

## Layout

Auth product chrome is a sticky 248px white sidebar plus a frosted topbar, then a cream workspace. Content columns are `min(--content-max, 100%)` (72rem) with `--page-pad` (0.65rem 1.35rem 1.6rem). Wide dashboards and ranking detail use `--content-max-wide` (84rem). Guest login/register narrows the column to 28rem.

Rhythm inside auth pages is dense: `--hero-gap` 0.7rem, `--section-gap` 0.7rem, `--card-gap` 0.6rem, `--card-pad` 0.85rem 1rem. Do not restore marketing-scale padding inside the shell.

`flow-hero` is a two-column intro (copy 1.35fr / art 0.75fr) that stacks at 720px, with art first on small screens. Toolbars wrap; primary flow CTAs go full-width below 720px. The sidebar becomes a fixed overlay with backdrop at 860px (`--menu-toggle` appears). Metric strips scroll at 1100px.

Guest marketing landing currently uses a separate canvas and a slightly different orange; it is not the Operate system. Auth workspace stays on `--cream` / `--brand`.

## Elevation & Depth

Hybrid: hairline `--line` (or brand-tinted 1px) defines the surface; soft ink-tinted shadows lift it. Resting cards use `--shadow-soft`; hover uses `--shadow-lift` plus a 1–1.5px `translateY`. Pill CTAs add a brand-tinted glow, not a hard offset drop. The sidebar uses a faint right-edge shadow. Focus is a 3–4px brand halo, not a black ring.

Tonal layering does the rest: cream canvas, white card, peach hero, `--brand-soft` for selected chrome.

### Shadow Vocabulary
- **Soft rest** (`box-shadow: 0 6px 18px rgba(28, 25, 23, 0.035)`): Default card, hero, empty state.
- **Ambient** (`box-shadow: 0 10px 28px rgba(28, 25, 23, 0.045)`): Panels and resting primary CTAs' ink companion (`--shadow`).
- **Lift** (`box-shadow: 0 16px 40px rgba(28, 25, 23, 0.08)`): Card hover.
- **Brand glow** (`0 10px 22px rgba(253, 83, 34, 0.22)` resting / `0 14px 28px rgba(253, 83, 34, 0.28)` hover): Solid pills and empty-state CTAs.
- **Focus halo** (`0 0 0 4px rgba(253, 83, 34, 0.12)` with brand-tinted border): Text fields on flow/pedir/empresa forms — the intended field focus. Converge generic inputs onto this.

### Named Rules
**The Soft Lift Rule.** Surfaces are nearly flat at rest. Motion is a short ease (0.2–0.22s), 1–1.5px rise, and a softer/larger shadow. No hard offset shadows.

## Shapes

Pills are the action silhouette (`--radius-pill` 999px): CTAs, chips, avatars, notification buttons. Work surfaces sit on `--radius` 16px. Dense list cards currently use 14px; heroes 18px; fields and sidebar links 12px. New work should consume `--radius` and `--radius-pill` rather than minting another step.

Borders are 1px `--line` on cards and chrome, 1.5px `--brand` on pills. Empty states may use a dashed brand-tinted border. Decorative hero rings are large, low-opacity brand circles — atmosphere, not a logo.

## Components

Shared primitives in `app/globals.css` are canonical. Page-prefixed twins (`pedir-*`, `emp-*`, `admin-*`, `indicar-*`, `meus-*`, `pontuacao-*`) should inherit these instead of drifting.

### Buttons
- **Shape:** Fully pill (`--radius-pill`).
- **Primary** (`pill-cta` / `btn-solid` / `flow-cta`): Brand fill, white type, 1.5px brand border, brand glow, 0.78rem 1.35rem (flow CTAs slightly tighter: 0.55rem 1rem, min-height 2.5rem), weight 650, 0.9rem.
- **Hover / Focus:** Brightness 1.045, `translateY(-1.5px)` (flow: −1px), stronger brand glow. Arrow children nudge 2px right. Transition ~0.22s ease.
- **Outline** (`pill-outline` / `btn-outline`): White/92% fill, brand type and border, quieter brand glow.
- **Ghost** (`flow-cta-ghost`): White fill, 1.5px translucent brand border, `--brand-deep` type; hover `--brand-soft`.
- **Small:** `.sm` padding 0.55rem 1.05rem, 0.82rem type.
- **Danger** (`pill-danger`): Destructive exception — solid `#b42318` pill, not Brand. Do not use Brand for irreversible delete.

### Chips
- **Flow chips:** White/82% fill, 1px brand-tinted border, `--brand-deep` type, pill, 0.32rem 0.65rem, 0.76rem / 650. Used as hero tips, not as a kicker substitute.
- **Status chips** (`flow-status--ok|info|done|muted|warn`): Pill, 0.72rem / 700, semantic fill + ink. Ok/info/warn map to `:root` status tokens.

### Cards / Containers
- **Corner Style:** 14px on `flow-card`; 16px on empty states and `--radius` panels.
- **Background:** `--card`.
- **Shadow Strategy:** `--shadow-soft` rest; `--shadow-lift` + 1.5px rise + brand-tinted border on hover.
- **Border:** 1px `rgba(236, 231, 225, 0.95)` (the `--line` family).
- **Internal Padding:** `--card-pad`. Stack gap `--card-gap`.
- **Empty:** Dashed brand-tinted border, peach illustration well, pill CTA.

### Inputs / Fields
- **Style:** White fill, 1px `--line`, 12px radius, 0.7rem 0.8rem, inherit Plus Jakarta Sans. Labels stack above at 0.92rem / 600.
- **Focus (intended):** Brand-tinted border (~55% brand) and 3–4px brand halo. This is already how pedir/empresa/indicar fields behave; generic `input` should match.
- **Error:** `--bad` hint text; error boxes use `#fef2f2` fill and `--bad` type at 12px radius. Success boxes use `#ecfdf5` / `--ok`.

### Navigation
- **Shell:** White 248px sidebar, 1px `--line` right edge; sticky topbar with `rgba(253, 249, 246, 0.92)` and 10px blur, `--topbar-pad`.
- **Brand mark:** `--brand` wordmark in Sora 700; logo 32px.
- **Links:** 12px corners, 500 weight, stone ink `#3f3a36`. Hover: 7% brand wash. Active: `--brand-soft` fill, `--brand` type, 650.
- **Sublinks:** 10px corners, 0.82rem; active mixes `--brand-soft` 70% with white.
- **Mobile (≤860px):** Sidebar slides from the left; dimmed backdrop; hamburger 10px-radius white button.
- **Guest header (unauth):** Sticky, peach-tinted blur, separate from the auth shell — do not mix the two.

### Flow hero (signature)
Canonical in-app intro: peach linear wash + white radial, 1px 10% brand border, `--shadow-soft`, 18px corners, `--hero-pad`. Two columns — Sora headline, muted 0.9rem lead, optional tip chips, peach illustration panel with a floating asset. Decorative low-opacity brand ring may drift slowly; honor `prefers-reduced-motion`.

`pedir-hero` is a near-copy with larger type/art. `emp-hero` and `admin-hero` reuse `--hero-pad` and 18px radius but switch to a white-to-cream flex bar (admin also substitutes `--admin-brand` `#ec5e27`). Treat those as drift to fold back into `flow-hero` + `:root`, not as a second identity.

## Do's and Don'ts

### Do:
- **Do** consume `:root` tokens (`--brand`, `--cream`, `--peach`, `--radius`, `--radius-pill`, `--content-max`, `--page-pad`, `--hero-pad`, `--card-pad`) for new screens.
- **Do** use pill Brand CTAs with the brand glow and 1–1.5px hover lift.
- **Do** set auth pages in the sidebar + topbar shell at 72rem (84rem only when the page is already `page-wide`).
- **Do** introduce in-app pages with `flow-hero` (peach wash, Sora title, muted lead, optional chips/art) instead of a new hero class.
- **Do** keep cards white, hairlined, softly lifted; status in semantic chips.

### Don't:
- **Don't** mint a parallel orange (`#ec5e27` or marketing `--mkt-brand`) inside the auth workspace when `--brand` is the source of truth.
- **Don't** add a second display font or replace Sora / Plus Jakarta Sans.
- **Don't** use square or 4–8px buttons for primary actions — pills are the action shape.
- **Don't** restore landing-scale padding or a marketing canvas (`#fdfdf1`) inside `workspace-body`.
- **Don't** treat peach as a second brand or flood a view with `--brand` fill; Brand is the accent, cream is the room.


### Location selection

`LocationPicker` owns the manual name/address fields and the expandable `MapLocationPicker`. Use Leaflet/OpenStreetMap for the manual fallback and Google Maps for Places search results, with provider attribution and the shared card/field/pill styles. The map loads on demand, supports click and keyboard selection, and resizes with its container. Address/name can be filled from a confirmed Places result or entered manually; navigation links use saved coordinates. Search calls Google services only when configured; manual fallback works without Google keys.

### Viewport containment

At 320px and wider, public header actions may wrap. User-supplied names, addresses and URLs wrap within cards; fields and flex/grid children must be allowed to shrink. Decorative profile glow stays inside its container.

`ViewportPopover` owns viewport-aware IBGE suggestion placement, using the shared dropdown styles and internal scrolling. Account menus and tutorial cards scroll within the available window height. The mobile sidebar has its own close control and uses dynamic viewport height. Map selection starts at the request municipality from the local server-side city dataset, with a previously saved point taking precedence.

### Admin navigation and map search

The admin sidebar groups existing links under Admin, Usuário and Empresa, with muted headings and thin dividers in the scrollable navigation area. Preview modes retain each account’s original navigation.

Map search uses an explicit search action, a scrollable numbered list and corresponding markers. A selected candidate shows its name, address and coordinates before confirmation. Keep search controls, result text and candidate feedback inside the shared map panel, with wrapping at mobile widths. Loading, empty and error states preserve manual selection. Maps and Places attribution stay visible; server credentials never enter browser configuration.
