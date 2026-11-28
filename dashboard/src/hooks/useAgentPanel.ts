import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AgentPanelState = { open: boolean; setOpen: (open: boolean) => void; toggle: () => void }

const store = create<AgentPanelState>()(
  persist(
    (set) => ({
      open: false,
      setOpen: (open) => set({ open }),
      toggle: () => set((s) => ({ open: !s.open })),
    }),
    {
      name: 'nextsci.agentPanel',
      partialize: ({ open }) => ({ open }),
      merge: (persisted, current) => {
        const open = (persisted as { open?: unknown } | null)?.open
        return typeof open === 'boolean' ? { ...current, open } : current
      },
    },
  ),
)

/** Whether the dispatch agent panel is open beside the main content. The choice is saved per browser. */
export function useAgentPanel() {
  return store()
}
