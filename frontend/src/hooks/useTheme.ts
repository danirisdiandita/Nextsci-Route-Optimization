import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const themePreferences = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof themePreferences)[number]

type ThemeState = {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

const STORAGE_KEY = 'nextsci.theme'

function isPreference(value: unknown): value is ThemePreference {
  return themePreferences.includes(value as ThemePreference)
}

const store = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    {
      name: STORAGE_KEY,
      partialize: ({ preference }) => ({ preference }),
      merge: (persisted, current) => {
        const preference = (persisted as { preference?: unknown } | null)?.preference
        return isPreference(preference) ? { ...current, preference } : current
      },
    },
  ),
)

// design.css resolves 'system' from the OS through color-scheme, so only an explicit choice sets the attribute.
// index.html runs the same logic inline before the first paint.
function apply({ preference }: ThemeState) {
  const root = document.documentElement
  if (preference === 'system') delete root.dataset.theme
  else root.dataset.theme = preference
}

// The website is also rendered to HTML at build time, where there is no document to apply the theme to.
if (typeof document !== 'undefined') {
  apply(store.getState())
  store.subscribe(apply)
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) void store.persist.rehydrate()
  })
}

export function useTheme() {
  return store()
}
