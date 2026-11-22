import { Outlet, useMatches, useRouteContext } from '@tanstack/react-router'
import { AppSidebar } from '@/app/shell/AppSidebar'
import { matchedSection } from '@/app/shell/sections'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const toggleShortcut = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘B' : 'Ctrl B'

export function AppShell() {
  const { user } = useRouteContext({ from: '/signed-in' })
  const active = useMatches({ select: matchedSection })
  const title = active?.label ?? 'Page not found'
  return (
    <TooltipProvider>
      <title>{`${title} · Nextsci`}</title>
      <SidebarProvider>
        <AppSidebar user={user} active={active} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
            <Tooltip>
              <TooltipTrigger render={<SidebarTrigger />} />
              <TooltipContent side="bottom">
                Toggle sidebar
                <kbd className="font-sans text-muted-foreground">{toggleShortcut}</kbd>
              </TooltipContent>
            </Tooltip>
            <h1 className="text-sm font-[560]">{title}</h1>
            <ThemeToggle className="ml-auto" />
          </header>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
