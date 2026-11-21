# Design system

Nextsci uses one visual language for the website, the dispatcher web app, and the driver app. It is dark, quiet, and precise. Content carries the color. The interface around it stays neutral.

The tokens below exist as CSS custom properties in `design.css`. The dashboard and the website each have an identical copy, [`dashboard/src/design.css`](dashboard/src/design.css) and [`frontend/src/design.css`](frontend/src/design.css). Change both copies in the same commit. `scripts/check.sh` fails when they differ. Use the variables in code. Do not paste raw hex values into components.

## Principles

- **Dark first.** The base is near-black, not gray. Surfaces lift by a few steps of lightness, never by heavy shadows.
- **Color means data.** Neutral grays build the interface. Saturated color marks routes, drivers, and status. One accent color marks the primary action.
- **Thin lines, soft light.** Separate regions with 1px borders at low opacity. Use a faint radial glow for emphasis instead of solid fills.
- **Tight, confident type.** Large headings use negative letter spacing and short line height. Body text stays small and calm.
- **Show the product.** Every marketing claim sits next to a picture of the interface that does it.
- **Motion is a hint.** Fade and lift by a few pixels. Never bounce or spin. Respect `prefers-reduced-motion`.

## Color

### Neutrals

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#08090a` | Page background |
| `--bg-raised` | `#0e0f10` | Alternate section background |
| `--surface` | `#131416` | Cards, panels, window frames |
| `--surface-hover` | `#1a1b1e` | Hover state of a surface |
| `--surface-inset` | `#0b0c0d` | Inputs, code blocks, map background |
| `--border` | `rgb(255 255 255 / 0.08)` | Default 1px border |
| `--border-strong` | `rgb(255 255 255 / 0.14)` | Hovered or focused border |
| `--text` | `#f7f8f8` | Headings and primary text |
| `--text-2` | `#c9ced6` | Body text |
| `--text-3` | `#8a8f98` | Secondary text and captions |
| `--text-4` | `#5d6168` | Disabled text and fine print |

### Accent and status

| Token | Value | Use |
| --- | --- | --- |
| `--accent` | `#5e9bff` | Links, focus rings, primary highlights |
| `--accent-soft` | `rgb(94 155 255 / 0.14)` | Accent backgrounds and glows |
| `--success` | `#4cc38a` | Delivered, on time |
| `--warning` | `#f5b544` | At risk, late soon |
| `--danger` | `#ef5a5a` | Failed, late |

### Route colors

Each driver gets one route color. Assign colors in this order, and reuse them in the same order after the sixth driver.

| Token | Value |
| --- | --- |
| `--route-1` | `#5e9bff` |
| `--route-2` | `#f2994a` |
| `--route-3` | `#4cc38a` |
| `--route-4` | `#c084fc` |
| `--route-5` | `#f5c451` |
| `--route-6` | `#38c6d9` |

## Typography

Use [Inter](https://rsms.me/inter/) with the variable weight axis. Enable the `cv11`, `ss01`, and `ss03` font features for the single-story `a` and the straight digits.

| Token | Size | Line height | Weight | Letter spacing | Use |
| --- | --- | --- | --- | --- | --- |
| `--font-display` | `clamp(44px, 7vw, 80px)` | 1.02 | 600 | -0.035em | Hero heading |
| `--font-h2` | `clamp(32px, 4.4vw, 52px)` | 1.08 | 600 | -0.03em | Section headings |
| `--font-h3` | `20px` | 1.3 | 560 | -0.012em | Card titles |
| `--font-lead` | `clamp(17px, 1.6vw, 20px)` | 1.55 | 400 | -0.005em | Text under a heading |
| `--font-body` | `15px` | 1.6 | 400 | 0 | Body text |
| `--font-small` | `13px` | 1.5 | 500 | 0 | Labels, captions, UI text |
| `--font-mono` | `13px` | 1.6 | 400 | 0 | Code, using `ui-monospace` |

Headings use `--text`. Give the hero heading a vertical gradient from `--text` to 55% opacity. Body text uses `--text-2`. Do not make body text pure white.

## Space, size, and shape

- **Spacing.** Use a 4px grid: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- **Content width.** Keep content at most 1120px wide (`--content`). Keep text blocks at most 640px wide.
- **Section rhythm.** Separate sections by 128px of vertical padding on desktop and 80px on mobile.
- **Radius.** `--radius-sm` 6px for buttons and chips, `--radius` 10px for cards, and `--radius-lg` 16px for product frames.
- **Elevation.** A raised surface has a 1px `--border` plus an inner top highlight, `inset 0 1px 0 rgb(255 255 255 / 0.05)`. Product frames add one large, soft shadow.

## Components

### Buttons

| Variant | Background | Text | Border | Use |
| --- | --- | --- | --- | --- |
| Primary | `#e8e9ea` | `#08090a` | none | One main action per view |
| Secondary | `--surface` | `--text` | `--border` | Other actions |
| Ghost | transparent | `--text-3` | none | Navigation and tertiary actions |

Buttons are 36px tall, or 44px tall in the hero. They use `--font-small` at weight 560 and `--radius-sm`. On hover, primary buttons turn white and secondary buttons switch to `--border-strong`.

### Pill

A pill is a small rounded label above a heading, such as a release note. It has a `--surface` background, a `--border`, `--font-small`, and an optional colored dot.

### Eyebrow

An eyebrow is a short label above a section heading. It uses `--font-small`, `--accent`, and weight 560. It is never all caps.

### Card

A card has a `--surface` background, a `--border`, `--radius`, and 24px padding. Its contents are an icon, then a title in `--font-h3`, then body text in `--text-3`. On hover, the border changes to `--border-strong`. Cards never move on hover.

### Product frame

A product frame is a static picture of the interface, drawn with HTML and SVG, not a screenshot. It has a `--surface` background, `--radius-lg`, a `--border`, and a 36px title bar with three neutral dots. Content inside the frame uses real interface tokens at 0.8 to 0.9 scale.

### Map

Draw maps with SVG on `--surface-inset`. Draw streets as 1px lines in `rgb(255 255 255 / 0.06)`. Draw routes as 2.5px lines in route colors with round joins. Draw stops as 7px circles with a 2px `--surface-inset` outline. Draw the depot as a white square.

### Icons

Draw icons as 16px or 20px inline SVG, with a 1.5px stroke, round caps, `currentColor`, and no fill. Put a feature icon in a 32px square with `--surface-hover` and `--radius-sm`.

## Sign-in screen

The dashboard opens on the sign-in screen at [`dashboard/src/App.tsx`](dashboard/src/App.tsx). It is a centered 360px column on `--bg` with a faint accent glow. The column holds the logo, a 24px heading, one line of `--text-3`, two inputs, and one full-width primary button. Inputs are 40px tall on `--surface-inset`. Their focus state is an `--accent` border with an `--accent-soft` ring. Errors appear above the button in a `--danger` tinted box with `role="alert"`. There is no sign-up link, because an administrator creates accounts.

## Landing page structure

The landing page lives in [`frontend/src/landing/`](frontend/src/landing/). It has these sections, in order:

1. **Navigation.** The logo, section links, and a GitHub button. The bar sticks to the top with a blurred background.
2. **Hero.** A release pill, the display heading, a lead, two buttons, and the dispatcher product frame.
3. **Value strip.** Three short facts about the project.
4. **Features.** A grid of eight cards that covers the full dispatch workflow.
5. **How it works.** Three numbered steps, each with a small product picture.
6. **Spotlights.** Alternating text and product frames for the solver and the driver app.
7. **Self-host.** The commands to run the stack, in a code frame.
8. **Roadmap.** Each planned capability with its status.
9. **Call to action and footer.**

All copy lives in [`frontend/src/landing/content.ts`](frontend/src/landing/content.ts). Change the copy there, not in the components.

## Writing on the page

- Describe what the product does. Name the mechanism, such as "time windows" or "vehicle capacity".
- Do not invent customers, logos, quotes, or numbers. The project is in early development, so mark planned features as planned.
- Use sentence case for headings and buttons.
- Use no emojis.

## Accessibility

- Text meets WCAG AA contrast on its background. `--text-3` on `--bg` is the lowest contrast allowed for body copy.
- Every interactive element has a visible focus ring, a 2px `--accent` outline with a 2px offset.
- Decorative SVGs have `aria-hidden="true"`. Product frames have a text alternative that describes what they show.
- Animations stop under `prefers-reduced-motion: reduce`.
