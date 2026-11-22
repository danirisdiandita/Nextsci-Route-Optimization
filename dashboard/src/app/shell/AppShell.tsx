import { useState } from 'react'
import { AppSidebar } from '@/app/shell/AppSidebar'
import { sections, type Section } from '@/app/shell/sections'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { User } from '@/features/auth/api'

const toggleShortcut = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘B' : 'Ctrl B'

export function AppShell({ user }: { user: User }) {
  const [active, setActive] = useState<Section>(sections[0])
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={user} active={active} onSelect={setActive} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
            <Tooltip>
              <TooltipTrigger render={<SidebarTrigger />} />
              <TooltipContent side="bottom">
                Toggle sidebar
                <kbd className="font-sans text-muted-foreground">{toggleShortcut}</kbd>
              </TooltipContent>
            </Tooltip>
            <h1 className="text-sm font-[560]">{active.label}</h1>
            <ThemeToggle className="ml-auto" />
          </header>
          <div className="flex flex-1 flex-col items-center justify-center p-6 pb-16 text-center">
            <span className="flex size-10 items-center justify-center rounded-lg border bg-card shadow-[var(--highlight)]">
              <active.icon aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
            <h2 className="mt-4 text-xl font-semibold tracking-[-0.012em]">{active.empty.title}</h2>
            <p className="mt-2 max-w-[440px] text-balance text-muted-foreground">{active.empty.body}</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
