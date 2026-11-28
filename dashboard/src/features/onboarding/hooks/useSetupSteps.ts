import { useWorkspace } from '@/hooks/useWorkspace'

const steps = [
  { key: 'depot', title: 'Add your depot', body: 'Where routes start and end', to: '/depots/new' },
  { key: 'drivers', title: 'Add drivers and vehicles', body: 'Who drives, when they work, and what each vehicle carries', to: '/drivers' },
  { key: 'stops', title: 'Import stops', body: 'Upload a spreadsheet or add stops one by one', to: '/stops/import' },
  { key: 'plan', title: 'Plan routes', body: 'Pick a date and drivers, then plan', to: '/routes/new' },
] as const

/** The four setup steps with whether each is done, derived from what the workspace holds. */
export function useSetupSteps() {
  const workspace = useWorkspace()
  const setup = workspace.data?.setup
  const list = steps.map((step) => ({ ...step, done: setup?.[step.key] ?? false }))
  return { ...workspace, steps: list, doneCount: list.filter((s) => s.done).length }
}
