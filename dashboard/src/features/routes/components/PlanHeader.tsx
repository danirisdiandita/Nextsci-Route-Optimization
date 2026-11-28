import { Link, useNavigate } from '@tanstack/react-router'
import { CalendarPlus, EllipsisVertical, GanttChart, Map as MapIcon, Play, RefreshCw, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { PlanView } from '@/api/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { HeaderSlot } from '@/components/HeaderSlot'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SendDialog } from '@/features/routes/components/SendDialog'
import { useDeletePlan } from '@/features/routes/hooks/useDeletePlan'
import { useReplan } from '@/hooks/useReplan'
import { useStartDay } from '@/hooks/useStartDay'
import { formatDay } from '@/lib/time'

const statusLabel = { draft: 'Draft', sent: 'Sent', live: 'Live' } as const

/** The plan's day and status after the section title, and the view switch and plan actions at the right. */
export function PlanHeader({ view, current, note }: { view: PlanView; current: 'map' | 'timeline'; note?: string }) {
  const { plan } = view
  const navigate = useNavigate()
  const replan = useReplan()
  const startDay = useStartDay()
  const deletePlan = useDeletePlan()
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const replanNow = () =>
    replan.mutate({ planId: plan.id }, { onSuccess: () => toast.success('Routes planned again'), onError: (e) => toast.error(e.message) })
  const start = () =>
    startDay.mutate(plan.id, {
      onSuccess: () => navigate({ to: '/routes/live' }),
      onError: (e) => toast.error(e.message),
    })
  return (
    <>
      <HeaderSlot slot="title">
        {!note && <span className="truncate font-[560] max-sm:hidden">{formatDay(plan.day)}</span>}
        <Badge variant="secondary" className="border-border">
          {statusLabel[plan.status]}
          {note && ` · ${note}`}
        </Badge>
      </HeaderSlot>
      <HeaderSlot slot="actions">
        <nav aria-label="Route views" className="flex rounded-lg border p-0.5">
          <ViewLink to="/routes" active={current === 'map'} icon={MapIcon} label="Map" />
          <ViewLink to="/routes/timeline" active={current === 'timeline'} icon={GanttChart} label="Timeline" />
        </nav>
        {plan.status !== 'live' && (
          <Button variant="outline" size="sm" className="max-sm:hidden" disabled={replan.isPending} onClick={replanNow}>
            <RefreshCw aria-hidden="true" />
            Re-plan
          </Button>
        )}
        {plan.status === 'draft' && (
          <Button size="sm" onClick={() => setSending(true)}>
            <Send aria-hidden="true" />
            <span className="max-sm:sr-only">Send to drivers</span>
          </Button>
        )}
        {plan.status === 'sent' && (
          <Button size="sm" disabled={startDay.isPending} onClick={start}>
            <Play aria-hidden="true" />
            <span className="max-sm:sr-only">Start the day</span>
          </Button>
        )}
        {plan.status === 'live' && (
          <Button size="sm" nativeButton={false} render={<Link to="/routes/live" />}>
            <Play aria-hidden="true" />
            <span className="max-sm:sr-only">Open live view</span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More plan actions" />}>
            <EllipsisVertical aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {plan.status !== 'live' && (
              <DropdownMenuItem className="sm:hidden" onClick={replanNow}>
                <RefreshCw aria-hidden="true" />
                Re-plan
              </DropdownMenuItem>
            )}
            {plan.status === 'sent' && (
              <DropdownMenuItem onClick={() => setSending(true)}>
                <Send aria-hidden="true" />
                Send again
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => navigate({ to: '/routes/new' })}>
              <CalendarPlus aria-hidden="true" />
              Plan a new day
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
              <Trash2 aria-hidden="true" />
              Delete plan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </HeaderSlot>
      <SendDialog view={view} open={sending} onOpenChange={setSending} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this plan?"
        description={`The routes for ${formatDay(plan.day)} and every change to them are deleted. Stops and drivers stay.`}
        confirmLabel="Delete plan"
        destructive
        pending={deletePlan.isPending}
        onConfirm={() =>
          deletePlan.mutate(plan.id, {
            onSuccess: () => {
              setDeleting(false)
              navigate({ to: '/routes' })
            },
            onError: (e) => toast.error(e.message),
          })
        }
      />
    </>
  )
}

function ViewLink({ to, active, icon: Icon, label }: { to: '/routes' | '/routes/timeline'; active: boolean; icon: typeof MapIcon; label: string }) {
  return (
    <Button
      variant="ghost"
      size="xs"
      className={active ? 'bg-muted text-foreground' : 'text-muted-foreground'}
      nativeButton={false}
      render={<Link to={to} aria-current={active ? 'page' : undefined} />}
    >
      <Icon aria-hidden="true" />
      <span className="max-sm:sr-only">{label}</span>
    </Button>
  )
}
