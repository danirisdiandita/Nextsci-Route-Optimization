import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App.tsx'
import type { PageId } from './pages'

export { pages } from './pages'

/** Renders one page to HTML at build time. scripts/prerender.mjs writes each into dist/<path>/index.html. */
export function render(page: PageId) {
  return renderToString(
    <StrictMode>
      <App page={page} />
    </StrictMode>,
  )
}
