import { Pause, Play } from 'lucide-react'
import { useState } from 'react'
import type { DayClock, Minute } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSetDayClock } from '@/hooks/useSetDayClock'
import { formatMinute } from '@/lib/time'

const speeds = [1, 5, 10, 30, 60]

/** Play, pause, speed, and a slider over the day for the simulated clock. */
export function ClockControls({ clock, minute, from, to }: { clock: DayClock; minute: Minute; from: Minute; to: Minute }) {
  const setClock = useSetDayClock()
  const [seeking, setSeeking] = useState<Minute | null>(null)
  const running = clock.kind === 'running'
  const commit = () => {
    if (seeking === null) return
    setClock.mutate({ kind: 'seek', minute: seeking }, { onSettled: () => setSeeking(null) })
  }
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Simulated clock">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={running ? 'Pause the clock' : 'Run the clock'}
        disabled={setClock.isPending}
        onClick={() => setClock.mutate({ kind: running ? 'pause' : 'run' })}
      >
        {running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </Button>
      <input
        type="range"
        aria-label="Time of day"
        aria-valuetext={formatMinute(seeking ?? minute)}
        className="w-36 accent-brand"
        min={from}
        max={to}
        step={5}
        value={Math.round(seeking ?? minute)}
        onChange={(e) => setSeeking(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <span className="w-11 text-sm font-[560] tabular-nums">{formatMinute(seeking ?? minute)}</span>
      <Select
        value={String(clock.speed)}
        onValueChange={(v) => v && setClock.mutate({ kind: 'speed', speed: Number(v) })}
        items={speeds.map((s) => ({ value: String(s), label: `${s}× speed` }))}
      >
        <SelectTrigger size="sm" aria-label="Clock speed" className="w-[110px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {speeds.map((s) => (
            <SelectItem key={s} value={String(s)}>{`${s}× speed`}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
