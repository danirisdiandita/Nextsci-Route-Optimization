import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronsUpDown, DatabaseBackup, Eraser, LogOut } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { sections, type Section } from '@/app/shell/sections'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import type { User } from '@/features/auth/api'
import { useSignOut } from '@/features/auth/hooks/useSignOut'
import { useClearWorkspace } from '@/hooks/useClearWorkspace'
import { useResetDemo } from '@/hooks/useResetDemo'

// Text beside an icon fades while the sidebar narrows to its icon rail, so it never shows half clipped.
const fade = 'transition-opacity duration-200 ease-out group-data-[collapsible=icon]:opacity-0'

type Props = { user: User; active: Section | undefined }

// Every icon, the logo, and the avatar center on one vertical axis, and every label starts at the same x,
// so nothing moves sideways when the sidebar collapses.
export function AppSidebar({ user, active }: Props) {
  const { setOpenMobile } = useSidebar()
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
        <div className="brand h-9 overflow-hidden pl-2">
          <img src="/favicon.svg" width={20} height={20} alt="" className="shrink-0" />
          <span className={fade}>Nextsci</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-1">
            {sections.map((section) => (
              <SidebarMenuItem key={section.path}>
                <SidebarMenuButton
                  isActive={section === active}
                  tooltip={section.label}
                  // The link sets aria-current itself. Exact matching keeps it on the same item as isActive,
                  // so a not-found path under /routes marks nothing current.
                  render={<Link to={section.path} activeOptions={{ exact: true, includeSearch: false }} />}
                  onClick={() => setOpenMobile(false)}
                >
                  <section.icon
                    aria-hidden="true"
                    className="text-muted-foreground group-hover/menu-button:text-foreground group-data-active/menu-button:text-foreground"
                  />
                  <span className={fade}>{section.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <UserMenu user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function UserMenu({ user }: { user: User }) {
  const signOut = useSignOut()
  const [confirm, setConfirm] = useState<keyof typeof demoChoices | null>(null)
  const { isMobile, state } = useSidebar()
  const collapsed = state === 'collapsed' && !isMobile
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton className="gap-2 p-1.5" />}>
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-[560] text-foreground ring-1 ring-border"
            >
              {user.email.charAt(0).toUpperCase()}
            </span>
            <span className={`min-w-0 flex-1 truncate ${fade}`}>{user.email}</span>
            <ChevronsUpDown aria-hidden="true" className={`mr-1 text-muted-foreground ${fade}`} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={collapsed ? 'right' : 'top'}
            align={collapsed ? 'end' : 'start'}
            sideOffset={collapsed ? 16 : 8}
            className="min-w-56"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
              <p className="truncate px-1.5 pb-1.5 text-sm text-foreground">{user.email}</p>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Demo data</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setConfirm('sample')}>
                <DatabaseBackup aria-hidden="true" />
                Reset demo data
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setConfirm('empty')}>
                <Eraser aria-hidden="true" />
                Start empty
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DemoDataDialog choice={confirm} onClose={() => setConfirm(null)} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

const demoChoices = {
  sample: {
    title: 'Reset demo data?',
    description: 'This replaces everything in this browser with the sample kitchen in Yogyakarta: one depot, ten drivers, 180 stops, and a draft plan for today.',
    confirmLabel: 'Reset demo data',
    done: 'Sample data loaded',
  },
  empty: {
    title: 'Start with an empty workspace?',
    description: 'This deletes every depot, driver, stop, and plan in this browser, so setup starts from the first step.',
    confirmLabel: 'Delete everything',
    done: 'Workspace emptied',
  },
} as const

/** Asks before the demo data is replaced, then opens the screen the workspace now starts on. */
function DemoDataDialog({ choice, onClose }: { choice: keyof typeof demoChoices | null; onClose: () => void }) {
  const reset = useResetDemo()
  const clear = useClearWorkspace()
  const navigate = useNavigate()
  const mutation = choice === 'empty' ? clear : reset
  const copy = demoChoices[choice ?? 'sample']
  const confirm = () =>
    mutation.mutate(undefined, {
      onSuccess: () => {
        onClose()
        toast.success(copy.done)
        void navigate({ to: '/' })
      },
      onError: (error) => toast.error(error.message),
    })
  return (
    <ConfirmDialog
      open={choice !== null}
      onOpenChange={(open) => !open && onClose()}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirmLabel}
      destructive
      pending={mutation.isPending}
      onConfirm={confirm}
    />
  )
}
