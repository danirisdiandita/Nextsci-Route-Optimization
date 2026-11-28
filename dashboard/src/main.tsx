import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design.css'
import './tailwind.css'
import { createAppRouter } from './app/router.tsx'

// The mock server answers from localStorage, so a failed call fails the same way every time. Retrying only
// delays the error message. Revisit when calls go over the network.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const router = createAppRouter(queryClient)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
