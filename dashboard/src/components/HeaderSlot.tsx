import { use, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { HeaderSlotContext } from '@/components/headerSlotContext'

/**
 * Renders into the shell header, so a screen can put its date, status badge, view switch, or main action
 * there, as the designs show. `title` sits after the section name. `actions` sits at the right.
 */
export function HeaderSlot({ slot, children }: { slot: 'title' | 'actions'; children: ReactNode }) {
  const target = use(HeaderSlotContext)[slot]
  return target ? createPortal(children, target) : null
}
