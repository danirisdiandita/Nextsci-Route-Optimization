# UI rules for the website and the dashboard

`frontend/` (the project website) and `dashboard/` (the app that self-hosters deploy) are separate apps with one visual design. A visitor who clicks from the website into a dashboard should not be able to tell where one ends. [`DESIGNS.md`](../DESIGNS.md) defines that design. This file tells you how to keep both apps on it.

Read `DESIGNS.md` before you change anything in `frontend/src/` or `dashboard/src/`.

## Rules that a script enforces

`scripts/check-design.sh` runs inside `scripts/check.sh`. It fails when you break one of these rules:

1. **`design.css` is identical in both apps.** It holds every token, the base styles, and the shared components. Edit `frontend/src/design.css`, then copy it with `cp frontend/src/design.css dashboard/src/design.css`. The same rule applies to `public/favicon.svg`, which is also the logo.
2. **No raw hex colors outside `design.css`.** Use `var(--token)` in CSS and in SVG attributes such as `fill` and `stroke`. If no token fits, add one to `design.css` and to the tables in `DESIGNS.md` in the same commit.
3. **Apps never restyle a shared component.** A rule that starts with a shared class, such as `.btn-primary { ... }`, belongs in `design.css` only. To place a shared component, scope it with a parent selector, such as `.topbar .brand { margin-right: auto; }`.

4. **Dashboard code never reads a shadcn theme variable.** `var(--secondary)` is undefined here, and `var(--accent)` and `var(--border)` mean something else in `design.css`. Use the mapped classes described below. Only `dashboard/src/tailwind.css` may read those names.
5. **`dashboard/src/tailwind.css` has no `:root` or `.dark` block.** shadcn's default theme block overrides the design tokens.

Run the check by itself with `./scripts/check-design.sh`.

## Dashboard components come from shadcn/ui

The dashboard builds its interface from [shadcn/ui](https://ui.shadcn.com) components on Tailwind CSS v4. The website does not use shadcn or Tailwind. It keeps the `.btn` classes from `design.css`. Both apps take every value from the same tokens, so they look the same.

- **Use shadcn for every interactive control.** Before you write a dialog, popover, menu, select, combobox, tooltip, tabs, toast, checkbox, or table, add the shadcn component. It handles focus, keyboard use, and screen readers, which hand-built versions usually get wrong.
- **Add a component from `dashboard/`.** Run `npx shadcn@latest add <name>`. The code lands in `src/components/ui/` and belongs to this repository, so edit it.
- **Fit each new component to `DESIGNS.md` before you use it.** Set control heights to 36px for buttons and 40px for inputs. Set button text to weight 560. Replace any raw shadcn variable with a mapped class. `components/ui/button.tsx` and `components/ui/input.tsx` are the reference.
- **Style with the mapped classes.** `src/tailwind.css` maps shadcn names to tokens: `bg-background`, `bg-card`, `bg-popover`, `bg-inset`, `text-foreground`, `text-muted-foreground`, `border-border`, `border-input`, `bg-primary`, `bg-muted`, `text-destructive`, `ring-ring`, and `text-brand` for the accent blue. When a token has no class, use it in an arbitrary value, such as `text-[var(--text-2)]`. Never write a hex or `oklch()` color.
- **Keep the mapping in one file.** If `shadcn init` or `shadcn add` rewrites `src/tailwind.css`, restore the `@theme inline` mapping and delete any `:root` or `.dark` block it added. The design check fails until you do.
- **Rename hooks that shadcn adds.** shadcn writes hooks such as `src/hooks/use-mobile.ts`. Rename each one to its hook name, such as `useIsMobile.ts`, so `scripts/check-react.sh` passes.
- **Skip `dark:` variants.** The design is dark only, and the dashboard never sets the `.dark` class.
- **Keep `design.css` rules inside their cascade layers.** Base rules sit in `@layer base` and shared components sit in `@layer components`, so Tailwind utilities and app styles override them. An unlayered rule in `design.css` would beat every Tailwind class.

## Rules that need your judgment

- **Build from shared components first.** In the dashboard, look in `src/components/ui/` and in the shadcn catalog. On the website, look in the shared components section of `design.css`. Use what exists if it is close enough.
- **Put a component where both apps can reach it.** If both apps need a component, or will soon, add it to `design.css` and describe it in `DESIGNS.md`. Keep a component in the app's own stylesheet only when the other app will never show it, such as the landing page's product frames.
- **Keep app stylesheets small.** `frontend/src/landing/landing.css` and `dashboard/src/app.css` hold layout and app-only parts. New rules take colors, type sizes, and radii from tokens.
- **Match type and spacing to the scales.** Use the type sizes in the `DESIGNS.md` typography table and the 4px spacing scale. Do not invent sizes like `17px` or `22px` margins. `landing.css` still has some literal sizes and `rgb()` tints from before these rules. Convert a block to tokens when you change it. Do not rewrite the file in a separate pass.
- **Keep the dashboard plain.** The dashboard is a work tool. Use the website's glows, gradients, and large display type only on the sign-in screen and empty states. Data screens use flat surfaces, 1px borders, and `--font-small` and `--font-body` text.
- **Use the same words in both apps.** Call things by the names in `DESIGNS.md` and the website copy: "route", "stop", "driver", "depot", and "time window". Do not rename them in the dashboard.
- **Write copy by the `DESIGNS.md` rules.** Use sentence case, no emojis, and no invented customers or numbers.
- **Mobile follows the same tokens.** React Native cannot import CSS. When you style a mobile screen, take values from the `DESIGNS.md` tables and keep them in one theme file under `mobile/src/`. After that file exists, change it in the same commit as any token it copies.

## Before you finish UI work

1. Run `./scripts/check.sh`. It includes the design check.
2. Run the changed app and look at it. Capture both widths with `scripts/screenshot.mjs`:

	```bash
	node scripts/screenshot.mjs http://localhost:5174/ /tmp/dashboard-1280.png 1280
	node scripts/screenshot.mjs http://localhost:5174/ /tmp/dashboard-390.png 390
	```

	The script prints a warning when the page scrolls sideways. Use it rather than Chrome's `--window-size`, which cannot go below 500px.
3. If you changed `design.css`, capture the other app too. A shared change shows up in both.
