import { Link } from '@tanstack/react-router'
import { SearchX } from 'lucide-react'
import { EmptyState } from '@/app/shell/EmptyState'
import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <EmptyState icon={SearchX} title="Page not found">
      <p className="mt-2 max-w-[440px] text-balance text-muted-foreground">
        Nothing in the dashboard lives at this address. Check the link, or go back to your routes.
      </p>
      <Button className="mt-6" nativeButton={false} render={<Link to="/routes" />}>
        Go to Routes
      </Button>
    </EmptyState>
  )
}
