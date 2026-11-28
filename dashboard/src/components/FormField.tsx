import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

type Props = {
  label: string
  /** The id of the control, so the label focuses it. */
  htmlFor: string
  hint?: ReactNode
  error?: string | null
  children: ReactNode
  className?: string
}

/** A label above a control, with an optional hint or error below it. */
export function FormField({ label, htmlFor, hint, error, children, className }: Props) {
  return (
    <div className={`grid gap-2 ${className ?? ''}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-[var(--danger-text)]">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}
