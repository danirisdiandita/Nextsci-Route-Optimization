# Design system

Nextsci uses one visual language for the website, the dispatcher web app, and the driver app. It is quiet and precise, and it comes in a dark theme and a light theme. Content carries the color. The interface around it stays neutral.

The dashboard renders these tokens through shadcn/ui components on Tailwind CSS. `dashboard/src/tailwind.css` maps shadcn's names to the tokens. The website uses plain CSS. [`.agents/ui.md`](.agents/ui.md) has the rules for both.

The tokens below exist as CSS custom properties in `design.css`. The dashboard and the website each have an identical copy, [`dashboard/src/design.css`](dashboard/src/design.css) and [`frontend/src/design.css`](frontend/src/design.css). Change both copies in the same commit. `scripts/check.sh` fails when they differ. Use the variables in code. Do not paste raw hex values into components.

## Principles

- **Dark first, light equal.** The dark base is near-black, not gray, and the light base is near-white. Surfaces lift by a few steps of lightness, never by heavy shadows. Every screen must work in both themes.
- **Color means data.** Neutral grays build the interface. Saturated color marks routes, drivers, and status. One accent color marks the primary action.
- **Thin lines, soft light.** Separate regions with 1px borders at low opacity. Use a faint radial glow for emphasis instead of solid fills.
- **Tight, confident type.** Large headings use negative letter spacing and short line height. Body text stays small and calm.
- **Show the product.** Every marketing claim sits next to a picture of the interface that does it.
- **Motion is a hint.** Fade and lift by a few pixels. Never bounce or spin. Respect `prefers-reduced-motion`.

## Color

### Themes

Each app offers three choices: **System**, **Light**, and **Dark**. System is the default and follows the operating system, including when it changes while the page is open. The choice is saved per browser.

- **Tokens hold both values.** Every color token in `design.css` is `light-dark(<light>, <dark>)`. CSS `color-scheme` picks the side: `light dark` by default, or one side when `<html>` has `data-theme="light"` or `data-theme="dark"`.
- **The store.** `src/hooks/useTheme.ts`, identical in both apps, keeps the choice in a zustand store persisted to `localStorage` under `nextsci.theme`, and sets or removes `data-theme`. An inline script in each `index.html` applies a saved choice before the first paint.
- **The switch.** A three-button group with Monitor, Sun, and Moon icons, labeled "System theme", "Light theme", and "Dark theme". The dashboard builds it from the shadcn toggle group (`src/components/ThemeToggle.tsx`) and the website from plain buttons (`src/landing/ThemeToggle.tsx`). It sits in the top bar, and at the top right of the sign-in screen.
- **Tints mix a token.** For a translucent color, mix a token with transparent, such as `color-mix(in srgb, var(--text) 10%, transparent)` for a hairline that is white on dark and black on light. Never write `rgb()` with fixed values outside `design.css`.

### Neutrals

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--bg` | `#08090a` | `#fcfcfd` | Page background |
| `--bg-raised` | `#0e0f10` | `#f5f6f7` | Alternate section background |
| `--surface` | `#131416` | `#ffffff` | Cards, panels, window frames |
| `--surface-hover` | `#1a1b1e` | `#f3f4f5` | Hover state of a surface |
| `--surface-inset` | `#0b0c0d` | `#f1f2f4` | Inputs, code blocks, map background |
| `--border` | `rgb(255 255 255 / 0.08)` | `rgb(15 16 18 / 0.09)` | Default 1px border |
| `--border-strong` | `rgb(255 255 255 / 0.14)` | `rgb(15 16 18 / 0.17)` | Hovered or focused border |
| `--text` | `#f7f8f8` | `#0f1012` | Headings and primary text |
| `--text-2` | `#c9ced6` | `#3c4047` | Body text |
| `--text-3` | `#8a8f98` | `#696e77` | Secondary text and captions |
| `--text-4` | `#5d6168` | `#9a9ea6` | Disabled text and fine print |
| `--shadow` | `#000000` | `rgb(15 16 18 / 0.18)` | Base for drop shadows; mix it, such as `color-mix(in srgb, var(--shadow) 70%, transparent)` |

### Accent and status

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--accent` | `#5e9bff` | `#2f6fe0` | Links, focus rings, primary highlights |
| `--accent-soft` | `rgb(94 155 255 / 0.14)` | `rgb(47 111 224 / 0.12)` | Accent backgrounds and glows |
| `--success` | `#4cc38a` | `#1d9460` | Delivered, on time |
| `--warning` | `#f5b544` | `#b7791f` | At risk, late soon |
| `--danger` | `#ef5a5a` | `#d93636` | Failed, late |
| `--danger-text` | `#f6a4a4` | `#b42323` | Error message text on a `--danger` tint |
| `--fill-primary` | `#e8e9ea` | `#0f1012` | Primary button background |
| `--fill-primary-hover` | `#ffffff` | `#2b2d31` | Primary button background on hover |

### Route colors

Each driver gets one route color. Assign colors in this order, and reuse them in the same order after the sixth driver.

| Token | Dark | Light |
| --- | --- | --- |
| `--route-1` | `#5e9bff` | `#2f6fe0` |
| `--route-2` | `#f2994a` | `#e07b25` |
| `--route-3` | `#4cc38a` | `#1d9460` |
| `--route-4` | `#c084fc` | `#9b5de5` |
| `--route-5` | `#f5c451` | `#c99a0e` |
| `--route-6` | `#38c6d9` | `#1a9fb4` |

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
- **Elevation.** A raised surface has a 1px `--border` plus an inner top highlight, `--highlight`. Product frames add one large, soft shadow.

## Components

The buttons, the `.brand` logo lockup, and the `.dot` status marker live in the shared components section of `design.css`. Both apps use those classes as they are. The components below that section are specified here, and each app builds them from tokens.

The logo is `public/favicon.svg`, the same file in both apps. Render it with an `<img>` element. Do not inline a copy of its SVG.

### Buttons

| Variant | Background | Text | Border | Use |
| --- | --- | --- | --- | --- |
| Primary | `--fill-primary` | `--bg` | none | One main action per view |
| Secondary | `--surface` | `--text` | `--border` | Other actions |
| Ghost | transparent | `--text-3` | none | Navigation and tertiary actions |

Buttons are 36px tall, or 44px tall in the hero. They use `--font-small` at weight 560 and `--radius-sm`. On hover, primary buttons move to `--fill-primary-hover` and secondary buttons switch to `--border-strong`.

### Pill

A pill is a small rounded label above a heading, such as a release note. It has a `--surface` background, a `--border`, `--font-small`, and an optional colored dot.

### Eyebrow

An eyebrow is a short label above a section heading. It uses `--font-small`, `--accent`, and weight 560. It is never all caps.

### Card

A card has a `--surface` background, a `--border`, `--radius`, and 24px padding. Its contents are an icon, then a title in `--font-h3`, then body text in `--text-3`. On hover, the border changes to `--border-strong`. Cards never move on hover.

### Product frame

A product frame is a static picture of the interface, drawn with HTML and SVG, not a screenshot. It has a `--surface` background, `--radius-lg`, a `--border`, and a 36px title bar with three neutral dots. Content inside the frame uses real interface tokens at 0.8 to 0.9 scale.

### Map

Draw maps with SVG on `--surface-inset`. Draw streets as 1px lines in `--text` at about 6%, through `color-mix()`. Draw routes as 2.5px lines in route colors with round joins. Draw stops as 7px circles with a 2px `--surface-inset` outline. Draw the depot as a `--text` square.

### Icons

Draw icons as 16px or 20px inline SVG, with a 1.5px stroke, round caps, `currentColor`, and no fill. Put a feature icon in a 32px square with `--surface-hover` and `--radius-sm`.

## Sign-in screen

The dashboard opens on the sign-in screen at [`dashboard/src/App.tsx`](dashboard/src/App.tsx). It is a centered 360px column on `--bg` with a faint accent glow. The column holds the logo, a 24px heading, one line of `--text-3`, two inputs, and one full-width primary button. Inputs are 40px tall on `--surface-inset`. Their focus state is an `--accent` border with an `--accent-soft` ring. Errors appear above the button in a `--danger` tinted box with `role="alert"`. There is no sign-up link, because an administrator creates accounts.

## Dashboard shell

After sign-in, the dashboard shows a sidebar beside the active section. The shell lives in [`dashboard/src/components/AppShell.tsx`](dashboard/src/components/AppShell.tsx), the sidebar in [`AppSidebar.tsx`](dashboard/src/components/AppSidebar.tsx), and the list of sections in [`sections.ts`](dashboard/src/components/sections.ts). Add a section to `sections.ts`, and the sidebar and the main area pick it up.

- **Sidebar.** 256px wide on `--bg-raised`, with a 1px `--border` on its right edge. The header holds the logo and "Nextsci". The middle holds one 36px button per section, each with a 16px icon and a `--font-small` label at weight 500. The footer holds the account button: an initial on a 24px circle and the email. The account button opens a menu with **Sign out**.
- **Item states.** Labels use `--text-2` and icons use `--text-3`. The active item has a fill of `--text` mixed at 5%, the inner top highlight, and `--text` for both icon and label. On hover, the item gets 60% of that fill. The fill is a tint rather than `--surface-hover`, because `--surface-hover` almost matches `--bg-raised` in the light theme. Keyboard focus shows the standard 2px `--accent` outline.
- **Collapsed.** The sidebar narrows to a 52px icon rail. Labels fade out, and each icon shows its label in a tooltip on hover. Every icon, the logo, and the avatar center on the same vertical line in both states, and every label starts at the same x, so nothing moves sideways. Toggle it with the header button, the rail on the sidebar edge, or Ctrl+B (⌘B on a Mac). A cookie keeps the choice across reloads.
- **Motion.** The width changes over 200ms with ease-out. It stops under `prefers-reduced-motion: reduce`.
- **Phone.** Under 768px the sidebar is a sheet that slides in from the left over the page, dimmed by `--shadow` at 70%. Choosing a section closes it.
- **Main area.** A 56px header holds the sidebar toggle and the section name on the left, and the theme switch on the right. Its bottom border lines up with the sidebar header's border. Below it, the section's empty state is centered: the section icon in a 40px raised square, a 20px title, and a short `--text-3` sentence that says the feature is planned.

## Landing page structure

The landing page lives in [`frontend/src/landing/`](frontend/src/landing/). It has these sections, in order:

1. **Navigation.** The logo, section links, the theme switch, and a GitHub button. The bar sticks to the top with a blurred background.
2. **Hero.** A release pill, the display heading, a lead, two buttons, and the dispatcher product frame.
3. **Value strip.** Three short facts about the project.
4. **Features.** A grid of eight cards that covers the full dispatch workflow.
5. **How it works.** Three numbered steps, each with a small product picture.
6. **Spotlights.** Alternating text and product frames for the solver and the driver app.
7. **Self-host.** The commands to run the stack, in a code frame.
8. **Roadmap.** Each planned capability with its status.
9. **Call to action and footer.** The footer shows the logo and a tagline, four link columns (Product, Services, Open source, Legal), and a note that Nextsci is open source with paid services and no hosted cloud. It appears on every page.

The terms of service (`/terms/`) and privacy policy (`/privacy/`) share the navigation and footer. Their body is a 720px column: the eyebrow, the title in `.h2`, the date it was last updated, a lead, then sections with `--font-h3` headings and `--font-body` text.

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
