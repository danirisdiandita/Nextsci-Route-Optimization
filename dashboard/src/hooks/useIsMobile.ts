import { useSyncExternalStore } from "react"

const MOBILE_QUERY = "(max-width: 767px)"

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

/** True below 768px, where the sidebar turns into a sheet. */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches)
}
