import { useEffect, useState } from 'react'
import { simulatedMinute } from '@/api/mock/clock'
import type { Minute } from '@/api/types'
import { useDayClock } from '@/hooks/useDayClock'

/** The current minute of the live day, updated every second while the clock runs. Null while it loads. */
export function useSimulatedMinute(): Minute | null {
  const { data: clock } = useDayClock()
  const [nowMs, setNowMs] = useState(() => Date.now())
  const running = clock?.kind === 'running'
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [running])
  if (!clock) return null
  // A clock that started after the last tick has not moved yet.
  return simulatedMinute(clock, clock.kind === 'running' ? Math.max(nowMs, clock.anchorEpochMs) : 0)
}
