import type { Workspace } from '../api/types.ts'

export type SetupKey = keyof Workspace['setup']

/** The four setup steps in order. The checklist lists them, and each step's screen sends the dispatcher to the next. */
export const setupSteps = [
  { key: 'depot', title: 'Add your depot', body: 'Where routes start and end', action: 'Add depot', to: '/depots/new' },
  { key: 'drivers', title: 'Add drivers and vehicles', body: 'Who drives, when they work, and what each vehicle carries', action: 'Add drivers', to: '/drivers' },
  { key: 'stops', title: 'Import stops', body: 'Upload a spreadsheet or add stops one by one', action: 'Import stops', to: '/stops/import' },
  { key: 'plan', title: 'Plan routes', body: 'Pick a date and drivers, then plan', action: 'Plan routes', to: '/routes/new' },
] as const satisfies readonly { key: SetupKey; title: string; body: string; action: string; to: string }[]

export type SetupStep = (typeof setupSteps)[number]

/** The first step not done yet, or null when setup is done. */
export function nextSetupStep(setup: Workspace['setup']): SetupStep | null {
  return setupSteps.find((s) => !setup[s.key]) ?? null
}
