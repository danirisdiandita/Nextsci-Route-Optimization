import { useSyncExternalStore } from 'react'

const WIDE_QUERY = '(min-width: 1024px)'

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(WIDE_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/** True from 1024px, where the agent panel sits beside the main content instead of over it. */
export function useIsWide() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(WIDE_QUERY).matches)
}
