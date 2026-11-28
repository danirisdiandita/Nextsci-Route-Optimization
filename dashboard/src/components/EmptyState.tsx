import { useMatches } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { matchedSection } from '@/app/shell/sections'

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 pb-16 text-center">
      <span className="flex size-10 items-center justify-center rounded-lg border bg-card shadow-[var(--highlight)]">
        <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
      </span>
      <h2 className="mt-4 text-xl font-semibold tracking-[-0.012em]">{title}</h2>
      {children}
    </div>
  )
}

export function PlannedSection() {
  const section = useMatches({ select: matchedSection })
  return (
    section && (
      <EmptyState icon={section.icon} title={section.empty.title}>
        <p className="mt-2 max-w-[440px] text-balance text-muted-foreground">{section.empty.body}</p>
      </EmptyState>
    )
  )
}
