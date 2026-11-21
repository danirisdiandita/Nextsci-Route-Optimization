# React code layout for the Vite apps

These rules apply to `dashboard/` and `frontend/`. Both are Vite + React + TypeScript apps. `scripts/check-react.sh` enforces every numbered rule, and `scripts/check.sh` runs it.

## Where code goes

| Folder | Holds | Imports React? |
| --- | --- | --- |
| `src/api/` | Plain async functions that call the server. They parse each response into a domain type and throw an `Error` whose message the user can read. | No |
| `src/hooks/` | Custom React hooks, one per file, and `queryKeys.ts` | Yes |
| everything else in `src/` | Components and styles | Yes |

1. **Every custom hook lives in `src/hooks/`.** Put each hook in its own file, named after the hook: `useRoutes` goes in `src/hooks/useRoutes.ts`, exported as `export function useRoutes`. A component file never defines a hook, not even a small one.
2. **TanStack Query appears only in `src/hooks/`.** `useQuery`, `useMutation`, `useQueryClient`, and every other import from `@tanstack/react-query` belong in a hook. The one exception is `src/main.tsx`, which creates the `QueryClient` and wraps the app in `QueryClientProvider`.
3. **Every file in `src/hooks/` is a hook, except `queryKeys.ts`.** Do not put helpers, types, or API calls there.
4. **Only `src/api/` calls `fetch`.** A hook calls an API function. A component calls a hook.

## Query keys

Define every query key in `src/hooks/queryKeys.ts`, then use it from there. Never write a key array inline in a hook.

```ts
export const queryKeys = {
	session: ['session'] as const,
	routes: (day: string) => ['routes', day] as const,
}
```

## Server state and local state

- Use TanStack Query for any data that comes from the server, including the signed-in session. Do not copy server data into `useState`, and do not fetch in `useEffect`.
- Use `useState` for state that only the screen owns, such as an open menu or a form draft.
- After a mutation, update the cache with `setQueryData` or `invalidateQueries` in the hook's `onSuccess`. Do not make components refetch by hand.

## Example

`dashboard/` follows these rules. Read these files before you add a hook:

- [`dashboard/src/api/auth.ts`](../dashboard/src/api/auth.ts) calls the server and returns domain types.
- [`dashboard/src/hooks/useSession.ts`](../dashboard/src/hooks/useSession.ts) wraps the session in a query.
- [`dashboard/src/hooks/useSignIn.ts`](../dashboard/src/hooks/useSignIn.ts) wraps sign-in in a mutation and updates the session in the cache.
- [`dashboard/src/App.tsx`](../dashboard/src/App.tsx) uses only hooks.

`frontend/` has no server data and does not install TanStack Query. If it needs server data, add `@tanstack/react-query` and follow the same layout.
