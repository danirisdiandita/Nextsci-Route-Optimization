# React code layout for the Vite apps

These rules apply to `dashboard/` and `frontend/`. Both are Vite + React + TypeScript apps. `scripts/check-react.sh` enforces every numbered rule, and `scripts/check.sh` runs it.

## Where code goes

| Folder | Holds | Imports React? |
| --- | --- | --- |
| `src/app/` | The route tree and its sign-in guards (`router.tsx`), and the signed-in shell (`shell/`). It connects the features, so it may import anything. | Yes |
| `src/features/<name>/` | One domain, such as `auth` or `routes`: `api.ts` calls the server, `hooks/` holds its hooks, and `components/` holds its screens | Yes, except `api.ts` |
| `src/components/` | Components that more than one feature uses. shadcn/ui code is in `src/components/ui/`. | Yes |
| `src/hooks/` | Hooks that more than one feature uses | Yes |
| `src/lib/` | Plain helpers and `queryKeys.ts` | No |
| `src/api/` | Server code that every feature shares. In the dashboard: the domain types (`types.ts`) and the mock server (`mock/`), described in [Mock server](#mock-server). | No |

An API module (`api.ts`, or files in `src/api/`) holds plain async functions. Each parses the response into a domain type and throws an `Error` whose message the user can read.

1. **Every custom hook lives in a hook folder.** Use `src/features/<name>/hooks/` when one feature uses the hook, and `src/hooks/` when several do. Put each hook in its own file, named after the hook: `useRoutes` goes in `src/features/routes/hooks/useRoutes.ts`, exported as `export function useRoutes`. A component file never defines a hook, not even a small one. The one exception is `src/components/ui/`, which holds shadcn code that may keep its internal hooks, such as `useFormField`.
2. **TanStack Query appears only in hook folders.** `useQuery`, `useMutation`, `useQueryClient`, and every other import from `@tanstack/react-query` belong in a hook. There are two exceptions. `src/main.tsx` creates the `QueryClient` and wraps the app in `QueryClientProvider`. `src/app/router.tsx` reads the session through that client in its route guards, which run before any component renders and so cannot call a hook.
3. **Every file in a hook folder is a hook.** Do not put helpers, types, or API calls there.
4. **Only API modules call `fetch`.** That is `src/features/<name>/api.ts` (or an `api/` folder when it grows), and `src/api/`. A hook calls an API function. A component calls a hook.
5. **A feature never imports another feature.** A file in `src/features/routes/` imports its own files and shared code, never `@/features/drivers/...` or `../../drivers/...`. Move code that two features need to `src/components/`, `src/hooks/`, or `src/lib/`. Put a screen that combines two features in `src/app/`.
6. **Shared code never imports a feature or the app.** Files in `src/components/`, `src/hooks/`, `src/lib/`, and `src/api/` never import from `src/features/` or `src/app/`.

## Add a feature

1. Create `src/features/<name>/` with `api.ts`, `hooks/`, and `components/`.
2. Add its query keys to `src/lib/queryKeys.ts`.
3. Give its screen a route in `src/app/router.tsx`, as [Routing](#routing) describes.
4. Run `./scripts/check-react.sh`.

## Routing

The dashboard uses [TanStack Router](https://tanstack.com/router) with a route tree written in code. There is no file-based routing and no route generator, so the folders above stay as they are.

- **The route tree.** `src/app/router.tsx` defines every route: `/sign-in`, the screens inside the shell, and `/`, which redirects to `/onboarding` while the workspace has no plan and to `/today` after. A pathless route with the id `signed-in` renders the shell (`src/app/shell/AppShell.tsx`), and each screen renders in the shell's `<Outlet />`. A catch-all `$` route in the shell shows the not-found page.
- **Screens with an id.** A route such as `/drivers/$driverId` reads the param in `router.tsx` and passes it to the screen as a prop, such as `<DriverPage driverId={...} />`. Feature components never import the route tree.
- **Titles and setup steps.** A route's `staticData` holds its `title`, which the header shows after the section as a breadcrumb (Depots › New depot), and its `setupStep`, which shows "Setup step N of 4" until setup is done.
- **The guards.** Route guards live in `router.tsx`, in each route's `beforeLoad`, and nowhere else. They read the session query from the `queryClient` in router context. A signed-out visit to a shell route goes to `/sign-in?redirect=<path>`. A signed-in visit to `/sign-in` goes to the path in `redirect`, or to `/` when there is none. The sign-in route's `validateSearch` drops any `redirect` that would leave this origin. Components never check the session to decide what to render.
- **The sidebar.** `src/app/shell/sections.ts` lists the sidebar sections in order: Today, Routes, Stops, Drivers, Depots. Each entry has a `path`, a label, and an icon. The sidebar links to each `path`, so an entry without a route fails the typecheck. The active item is the section whose path starts the matched route's path, so `/depots/new` marks Depots. The header title and the document title come from the matched route.
- **The header.** A screen puts its own date, badge, view switch, or main action in the shell header with `<HeaderSlot slot="title">` or `<HeaderSlot slot="actions">` from `src/components/HeaderSlot.tsx`. The header's **Agent** button opens the dispatch agent panel beside the screen. Its content is `src/features/assistant/components/AssistantPanel.tsx`, and `useAgentPanel` in `src/hooks/` keeps it open or closed.
- **After sign-in or sign-out.** `useSignIn` writes the session into the cache and calls `router.invalidate()`, which reruns the guards. `useSignOut` clears the session and navigates to `/sign-in`.

To add a screen to the shell:

1. Create its feature folder, as [Add a feature](#add-a-feature) describes.
2. Add a route under `signedInRoute` in `router.tsx` with the screen as its `component`, using `shellRoute('/<path>', Screen, { title })`.
3. Add an entry to `sections` in `sections.ts` if the screen belongs in the sidebar.
4. Link to it with `<Link to="/<path>">` from `@tanstack/react-router`. The link type checks the path against the route tree.

## Mock server

The dashboard has no backend for depots, drivers, stops, or plans yet. Until it does, `src/api/mock/` plays the server in the browser. Every table lives in one localStorage key, `nextsci.mock.v1`, and every call waits 150 ms, so loading states show.

- **Types.** `src/api/types.ts` holds the domain types: `Depot`, `Vehicle`, `Driver`, `Order` (a stop), `OrderImport`, `Plan`, `Route`, `PlanChange`, `Dispatch`, `AgentMessage`, and the rest. They mirror the backend tables, use singular names, and stay when the mock goes. Ids are branded per entity, such as `DriverId`, so two kinds of id never mix.
- **Modules.** One module per entity, such as `mock/driver.ts`, holds its async CRUD functions. Each returns domain types and throws an `Error` whose message the dashboard shows as it is. `mock/cascade.ts` holds what a delete does to the rows that point at it. `mock/fleet.ts` saves a driver and the vehicle they drive in one write, for the setup screens. `mock/planner.ts` is a deterministic solver, `mock/geocode.ts` a fake geocoder for Yogyakarta, `mock/csv.ts` the spreadsheet import, and `mock/clock.ts` the simulated live day. `mock/agent.ts` is the dispatch agent, rule-based with no language model: `agentLanguage.ts` reads a message into intents with a table of patterns, `agentToday.ts` derives the stage of the day that Today shows, and `agentSetup.ts` drafts a depot and fleet from a description.
- **Data.** A first visit starts with an empty workspace, so the setup checklist shows. `resetDemo()` in `mock/workspace.ts` loads the sample: a kitchen in Yogyakarta with ten drivers, 180 stops, and a draft plan for today. `clearAll()` empties it. The user menu offers both.
- **Tests.** `npm test` in `dashboard/` runs every `tests/*.test.ts` with Node's test runner: `mock.test.ts` for the mock server, `agent.test.ts` for the agent. Add a test there when you change how the mock behaves.

### Call the mock from a feature

1. Re-export the functions the feature calls from its `api.ts`, such as `export { createDepot } from '@/api/mock/depot'`.
2. Wrap each in a hook. A read uses `useQuery` with a key from `queryKeys.ts`. A write uses `useWorkspaceMutation` from `src/hooks/`, which refreshes every query under the `workspace` key prefix when it succeeds. One write can change several tables, so no hook lists what to refresh by hand.
3. Data that several features read, such as `useDrivers`, `useOrders`, and `useCurrentPlan`, already has a hook in `src/hooks/`. Use it instead of writing a second one.

### Move a call to the backend

Replace the re-export in the feature's `api.ts`, or the import in the shared hook, with a function of the same signature that calls `fetch` and parses the response into the type from `src/api/types.ts`. The hooks and screens do not change. Delete the mock module when nothing imports it.

## Query keys

Define every query key in `src/lib/queryKeys.ts`, then use it from there. Never write a key array inline in a hook.

```ts
export const queryKeys = {
	session: ['session'] as const,
	routes: (day: string) => ['routes', day] as const,
}
```

## Server state and local state

- Use TanStack Query for any data that comes from the server, including the signed-in session. Do not copy server data into `useState`, and do not fetch in `useEffect`.
- Use `useState` for state that only the screen owns, such as an open menu or a form draft.
- Use a zustand store for client state that outlives a screen or the page, such as the theme choice. Keep the store private to its hook file in `src/hooks/` and export only the `useX` hook, as `useTheme.ts` does. Use the `persist` middleware to save it, and validate what it reads back in `merge`.
- After a mutation, update the cache with `setQueryData` or `invalidateQueries` in the hook's `onSuccess`. Do not make components refetch by hand.

## Example

`dashboard/` follows these rules, and `dashboard/src/features/auth/` is the model feature. Read these files before you add a hook:

- [`dashboard/src/features/auth/api.ts`](../dashboard/src/features/auth/api.ts) calls the server and returns domain types.
- [`dashboard/src/features/auth/hooks/useSignIn.ts`](../dashboard/src/features/auth/hooks/useSignIn.ts) wraps sign-in in a mutation, updates the session in the cache, and reruns the route guards.
- [`dashboard/src/features/auth/components/SignInPage.tsx`](../dashboard/src/features/auth/components/SignInPage.tsx) uses only hooks.
- [`dashboard/src/app/router.tsx`](../dashboard/src/app/router.tsx) reads the session query in its route guards.

`frontend/` has no features or server data, keeps its pages in `src/landing/`, and does not install TanStack Query. If it needs server data, add `@tanstack/react-query` and follow the same layout.
