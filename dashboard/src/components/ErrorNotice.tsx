/** An error the dispatcher should read, in a danger-tinted box. Renders nothing without an error. */
export function ErrorNotice({ error, className }: { error: Error | null | undefined; className?: string }) {
  if (!error) return null
  return (
    <p
      role="alert"
      className={`rounded-md border px-3 py-2 text-sm text-[var(--danger-text)] ${className ?? ''}`}
      style={{ background: 'color-mix(in srgb, var(--danger) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)' }}
    >
      {error.message}
    </p>
  )
}
