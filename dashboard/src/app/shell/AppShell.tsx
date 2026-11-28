import { Outlet, useMatches, useRouteContext } from '@tanstack/react-router'
import { ChevronRight, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { AppSidebar } from '@/app/shell/AppSidebar'
import { screenOf, type SetupStep } from '@/app/shell/sections'
import { HeaderSlotContext } from '@/components/headerSlotContext'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { AssistantPanel } from '@/features/assistant/components/AssistantPanel'
import { useAgentPanel } from '@/hooks/useAgentPanel'
import { useIsWide } from '@/hooks/useIsWide'
import { useWorkspace } from '@/hooks/useWorkspace'

const toggleShortcut = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘B' : 'Ctrl B'

// The main column scrolls by itself, so the agent panel beside it keeps its composer in view.
export function AppShell() {
  const { user } = useRouteContext({ from: '/signed-in' })
  const screen = useMatches({ select: screenOf })
  const agent = useAgentPanel()
  const wide = useIsWide()
  const [title, setTitle] = useState<HTMLElement | null>(null)
  const [actions, setActions] = useState<HTMLElement | null>(null)
  return (
    <TooltipProvider>
      <title>{`${screen.title} · Nextsci`}</title>
      <SidebarProvider>
        <AppSidebar user={user} active={screen.section} />
        <SidebarInset className="h-svh flex-row overflow-hidden">
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
              <Tooltip>
                <TooltipTrigger render={<SidebarTrigger />} />
                <TooltipContent side="bottom">
                  Toggle sidebar
                  <kbd className="font-sans text-muted-foreground">{toggleShortcut}</kbd>
                </TooltipContent>
              </Tooltip>
              {screen.crumb && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground max-sm:hidden">
                  {screen.crumb}
                  <ChevronRight aria-hidden="true" className="size-3.5" />
                </span>
              )}
              <h1 className="truncate text-sm font-[560]">{screen.title}</h1>
              <div ref={setTitle} className="flex min-w-0 items-center gap-2 text-sm" />
              <div className="ml-auto flex items-center gap-2">
                <SetupStepHint step={screen.setupStep} />
                <div ref={setActions} className="flex items-center gap-2" />
                <Button variant="outline" size="sm" aria-pressed={agent.open} onClick={agent.toggle}>
                  <Sparkles aria-hidden="true" className="text-brand" />
                  Agent
                </Button>
                <ThemeToggle className="max-sm:hidden" />
              </div>
            </header>
            <HeaderSlotContext value={{ title, actions }}>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <Outlet />
              </div>
            </HeaderSlotContext>
          </div>
          {wide ? (
            agent.open && (
              <aside aria-label="Dispatch agent" className="w-[380px] shrink-0 border-l bg-background">
                <AssistantPanel />
              </aside>
            )
          ) : (
            <Sheet open={agent.open} onOpenChange={agent.setOpen}>
              <SheetContent side="right" showCloseButton={false} className="w-full gap-0 p-0 sm:max-w-[380px]">
                <SheetTitle className="sr-only">Dispatch agent</SheetTitle>
                <AssistantPanel />
              </SheetContent>
            </Sheet>
          )}
        </SidebarInset>
      </SidebarProvider>
      <Toaster position="bottom-center" />
    </TooltipProvider>
  )
}

/** "Setup step 2 of 4" on the screens the setup checklist links to, until all four steps are done. */
function SetupStepHint({ step }: { step: SetupStep | undefined }) {
  const { data: workspace } = useWorkspace()
  const setupDone = workspace && Object.values(workspace.setup).every(Boolean)
  if (!step || !workspace || setupDone) return null
  return <span className="text-xs text-muted-foreground max-md:hidden">{`Setup step ${step} of 4`}</span>
}
