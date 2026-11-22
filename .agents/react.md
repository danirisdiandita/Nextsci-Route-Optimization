# React code layout for the Vite apps

These rules apply to `dashboard/` and `frontend/`. Both are Vite + React + TypeScript apps. `scripts/check-react.sh` enforces every numbered rule, and `scripts/check.sh` runs it.

## Where code goes

| Folder | Holds | Imports React? |
| --- | --- | --- |
| `src/app/` | The session gate (`App.tsx`) and the signed-in shell (`shell/`). It connects the features, so it may import anything. | Yes |
| `src/features/<name>/` | One domain, such as `auth` or `routes`: `api.ts` calls the server, `hooks/` holds its hooks, and `components/` holds its screens | Yes, except `api.ts` |
| `src/components/` | Components that more than one feature uses. shadcn/ui code is in `src/components/ui/`. | Yes |
| `src/hooks/` | Hooks that more than one feature uses | Yes |
| `src/lib/` | Plain helpers and `queryKeys.ts` | No |
| `src/api/` | Server code that every feature shares, such as a request helper. The dashboard has none yet. | No |

An API module (`api.ts`, or files in `src/api/`) holds plain async functions. Each parses the response into a domain type and throws an `Error` whose message the user can read.

1. **Every custom hook lives in a hook folder.** Use `src/features/<name>/hooks/` when one feature uses the hook, and `src/hooks/` when several do. Put each hook in its own file, named after the hook: `useRoutes` goes in `src/features/routes/hooks/useRoutes.ts`, exported as `export function useRoutes`. A component file never defines a hook, not even a small one. The one exception is `src/components/ui/`, which holds shadcn code that may keep its internal hooks, such as `useFormField`.
2. **TanStack Query appears only in hook folders.** `useQuery`, `useMutation`, `useQueryClient`, and every other import from `@tanstack/react-query` belong in a hook. The one exception is `src/main.tsx`, which creates the `QueryClient` and wraps the app in `QueryClientProvider`.
3. **Every file in a hook folder is a hook.** Do not put helpers, types, or API calls there.
4. **Only API modules call `fetch`.** That is `src/features/<name>/api.ts` (or an `api/` folder when it grows), and `src/api/`. A hook calls an API function. A component calls a hook.
5. **A feature never imports another feature.** A file in `src/features/routes/` imports its own files and shared code, never `@/features/drivers/...` or `../../drivers/...`. Move code that two features need to `src/components/`, `src/hooks/`, or `src/lib/`. Put a screen that combines two features in `src/app/`.
6. **Shared code never imports a feature or the app.** Files in `src/components/`, `src/hooks/`, `src/lib/`, and `src/api/` never import from `src/features/` or `src/app/`.

## Add a feature

1. Create `src/features/<name>/` with `api.ts`, `hooks/`, and `components/`.
2. Add its query keys to `src/lib/queryKeys.ts`.
3. Render its screen from `src/app/`, such as from the shell in `src/app/shell/`.
4. Run `./scripts/check-react.sh`.

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
- [`dashboard/src/features/auth/hooks/useSession.ts`](../dashboard/src/features/auth/hooks/useSession.ts) wraps the session in a query.
- [`dashboard/src/features/auth/hooks/useSignIn.ts`](../dashboard/src/features/auth/hooks/useSignIn.ts) wraps sign-in in a mutation and updates the session in the cache.
- [`dashboard/src/app/App.tsx`](../dashboard/src/app/App.tsx) uses only hooks.

`frontend/` has no features or server data, keeps its pages in `src/landing/`, and does not install TanStack Query. If it needs server data, add `@tanstack/react-query` and follow the same layout.
