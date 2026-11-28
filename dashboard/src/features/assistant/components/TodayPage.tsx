import { ErrorNotice } from '@/components/ErrorNotice'
import { HeaderSlot } from '@/components/HeaderSlot'
import { Skeleton } from '@/components/ui/skeleton'
import type { TodayView } from '@/features/assistant/api'
import { DescribeStage } from '@/features/assistant/components/DescribeStage'
import { DraftStage } from '@/features/assistant/components/DraftStage'
import { GoalsStage } from '@/features/assistant/components/GoalsStage'
import { LiveStage } from '@/features/assistant/components/LiveStage'
import { OrdersStage } from '@/features/assistant/components/OrdersStage'
import { PlanStage } from '@/features/assistant/components/PlanStage'
import { ReviewStage } from '@/features/assistant/components/ReviewStage'
import { SendStage } from '@/features/assistant/components/SendStage'
import { SentStage } from '@/features/assistant/components/SentStage'
import { useToday } from '@/features/assistant/hooks/useToday'
import { formatDay } from '@/lib/time'

/**
 * The agent's home for the day (designs NS 01 to NS 08). The stage comes from the workspace and the
 * conversation, so the page shows the same step after a reload and moves on when the agent does.
 */
export function TodayPage() {
  const { data: today, error } = useToday()
  if (error) return <ErrorNotice error={error} className="m-6" />
  if (!today) return <Skeleton className="m-6 h-64" />
  return (
    <>
      <HeaderSlot slot="title">
        <span className="text-muted-foreground">{`· ${formatDay(today.day)}`}</span>
      </HeaderSlot>
      <Stage today={today} />
    </>
  )
}

function Stage({ today: { stage, day, depot } }: { today: TodayView }) {
  switch (stage.kind) {
    case 'describe':
      return <DescribeStage />
    case 'draft':
      return <DraftStage draft={stage.draft} questions={stage.questions} />
    case 'orders':
      return <OrdersStage />
    case 'review':
      return <ReviewStage review={stage.review} day={day} depot={depot} />
    case 'goals':
      return <GoalsStage stage={stage} />
    case 'plan':
      return <PlanStage view={stage.view} proposal={stage.proposal} depot={depot} />
    case 'send':
      return <SendStage view={stage.view} send={stage.send} day={day} />
    case 'sent':
      return <SentStage view={stage.view} send={stage.send} dispatches={stage.dispatches} />
    case 'live':
      return <LiveStage stage={stage} depot={depot} />
  }
}
