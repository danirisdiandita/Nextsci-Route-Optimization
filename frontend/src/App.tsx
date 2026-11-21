import type { ReactNode } from 'react'
import Landing from './landing/Landing'
import LegalPage from './landing/LegalPage'
import { Footer, Nav } from './landing/Site'
import { privacy, terms } from './landing/legal'
import type { PageId } from './pages'

const body: Record<PageId, ReactNode> = {
  home: <Landing />,
  terms: <LegalPage doc={terms} />,
  privacy: <LegalPage doc={privacy} />,
}

export default function App({ page }: { page: PageId }) {
  return (
    <>
      <Nav />
      {body[page]}
      <Footer />
    </>
  )
}
