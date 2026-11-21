export type PageId = 'home' | 'terms' | 'privacy'

export type Page = { id: PageId; path: string; title: string }

export const pages: Page[] = [
  { id: 'home', path: '/', title: 'Nextsci · Open-source route planning' },
  { id: 'terms', path: '/terms/', title: 'Terms of service · Nextsci' },
  { id: 'privacy', path: '/privacy/', title: 'Privacy policy · Nextsci' },
]

export function pageFromPath(pathname: string): PageId {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`
  return pages.find((p) => p.path === path)?.id ?? 'home'
}
