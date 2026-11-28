import { createContext } from 'react'

/** The two places in the shell header that a screen can fill: after the title, and at the right before the shell's own buttons. */
export type HeaderSlots = { title: HTMLElement | null; actions: HTMLElement | null }

export const HeaderSlotContext = createContext<HeaderSlots>({ title: null, actions: null })
