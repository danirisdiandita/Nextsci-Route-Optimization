import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './design.css'
import App from './App.tsx'
import { pageFromPath } from './pages'

const root = document.getElementById('root')!
const app = (
  <StrictMode>
    <App page={pageFromPath(location.pathname)} />
  </StrictMode>
)

// The production build ships prerendered HTML to hydrate. The dev server serves an empty root.
if (root.firstElementChild) hydrateRoot(root, app)
else createRoot(root).render(app)
