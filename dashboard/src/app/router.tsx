import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
  type StaticDataRouteOption,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { getWorkspace } from '@/api/mock/workspace'
import type { DepotId, DriverId, OrderId, OrderImportId } from '@/api/types'
import { AppShell } from '@/app/shell/AppShell'
import { NotFound } from '@/app/shell/NotFound'
import { TodayPage } from '@/features/assistant/components/TodayPage'
import { restoreSession } from '@/features/auth/api'
import { SignInPage } from '@/features/auth/components/SignInPage'
import { DepotPage } from '@/features/depots/components/DepotPage'
import { DepotsPage } from '@/features/depots/components/DepotsPage'
import { NewDepotPage } from '@/features/depots/components/NewDepotPage'
import { DriverPage } from '@/features/drivers/components/DriverPage'
import { DriversPage } from '@/features/drivers/components/DriversPage'
import { NewDriverPage } from '@/features/drivers/components/NewDriverPage'
import { VehiclesPage } from '@/features/drivers/components/VehiclesPage'
import { SetupChecklist } from '@/features/onboarding/components/SetupChecklist'
import { LivePage } from '@/features/routes/components/LivePage'
import { NewPlanPage } from '@/features/routes/components/NewPlanPage'
import { RoutesPage } from '@/features/routes/components/RoutesPage'
import { TimelinePage } from '@/features/routes/components/TimelinePage'
import { ImportMappingPage } from '@/features/stops/components/ImportMappingPage'
import { ImportPage } from '@/features/stops/components/ImportPage'
import { ImportReviewPage } from '@/features/stops/components/ImportReviewPage'
import { NewStopPage } from '@/features/stops/components/NewStopPage'
import { StopPage } from '@/features/stops/components/StopPage'
import { StopsPage } from '@/features/stops/components/StopsPage'
import { queryKeys } from '@/lib/queryKeys'

// The session query is the only record of who is signed in. Sign-in and sign-out write it in the cache.
const session = (queryClient: QueryClient) =>
  queryClient.query({ queryKey: queryKeys.session, queryFn: restoreSession, staleTime: Infinity })

// A redirect target must stay on this origin: a path such as /drivers, never //evil.example or a full URL.
const isSafeRedirect = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith('/') && new URL(value, location.origin).origin === location.origin

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()()

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  // Set redirect even when it is unsafe: the router lays the validated search over the raw query string,
  // so a key left out keeps its raw value.
  validateSearch: (search): { redirect?: string } => ({
    redirect: isSafeRedirect(search.redirect) ? search.redirect : undefined,
  }),
  beforeLoad: async ({ context, search }) => {
    if (await session(context.queryClient)) throw redirect({ href: search.redirect ?? '/' })
  },
  component: SignInPage,
})

// A workspace that has never planned a day opens on the setup checklist. Otherwise it opens on Today.
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async ({ context }) => {
    const workspace = await context.queryClient.fetchQuery({ queryKey: queryKeys.workspaceSummary, queryFn: getWorkspace })
    throw redirect({ to: workspace.currentPlanId ? '/today' : '/onboarding' })
  },
})

// Every screen except sign-in sits in the shell, and only a signed-in user reaches it.
const signedInRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'signed-in',
  beforeLoad: async ({ context, location }) => {
    const signedIn = await session(context.queryClient)
    if (!signedIn) throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    return { user: signedIn.user }
  },
  component: AppShell,
})

// Screens with an id in the path get it as a prop, so feature components never import the route tree.
const depotRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: '/depots/$depotId',
  staticData: { title: 'Depot' },
  component: function DepotRoute() {
    return <DepotPage depotId={depotRoute.useParams().depotId as DepotId} />
  },
})
const driverRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: '/drivers/$driverId',
  staticData: { title: 'Driver' },
  component: function DriverRoute() {
    return <DriverPage driverId={driverRoute.useParams().driverId as DriverId} />
  },
})
const stopRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: '/stops/$orderId',
  staticData: { title: 'Stop' },
  component: function StopRoute() {
    return <StopPage orderId={stopRoute.useParams().orderId as OrderId} />
  },
})
const importMappingRoute = createRoute({
  getParentRoute: () => signedInRoute,
  path: '/stops/import/$importId',
  staticData: { title: 'Import', setupStep: 3 },
  component: function ImportMappingRoute() {
    return <ImportMappingPage importId={importMappingRoute.useParams().importId as OrderImportId} />
  },
})

const shellRoute = <const TPath extends string>(path: TPath, component: () => ReactNode, staticData: StaticDataRouteOption = {}) =>
  createRoute({ getParentRoute: () => signedInRoute, path, component, staticData })

const routeTree = rootRoute.addChildren([
  signInRoute,
  indexRoute,
  signedInRoute.addChildren([
    shellRoute('/today', TodayPage),
    shellRoute('/onboarding', SetupChecklist, { title: 'Get started' }),
    shellRoute('/routes', RoutesPage),
    shellRoute('/routes/new', NewPlanPage, { title: 'New plan', setupStep: 4 }),
    shellRoute('/routes/timeline', TimelinePage, { title: 'Timeline' }),
    shellRoute('/routes/live', LivePage, { title: 'Live' }),
    shellRoute('/stops', StopsPage),
    shellRoute('/stops/new', NewStopPage, { title: 'New stop' }),
    shellRoute('/stops/import', ImportPage, { title: 'Import', setupStep: 3 }),
    importMappingRoute,
    shellRoute('/stops/review', ImportReviewPage, { title: 'Review import', setupStep: 3 }),
    stopRoute,
    shellRoute('/drivers', DriversPage, { setupStep: 2 }),
    shellRoute('/drivers/new', NewDriverPage, { title: 'New driver' }),
    shellRoute('/drivers/vehicles', VehiclesPage, { title: 'Vehicles' }),
    driverRoute,
    shellRoute('/depots', DepotsPage),
    shellRoute('/depots/new', NewDepotPage, { title: 'New depot', setupStep: 1 }),
    depotRoute,
    // Any other path, so a signed-in user sees the not-found page inside the shell.
    shellRoute('$', NotFound),
  ]),
])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient } })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
