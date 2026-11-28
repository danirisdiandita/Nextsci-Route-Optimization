// The calls this feature makes. Today they run against the mock server in src/api/mock/. To move one to the
// backend, replace its re-export with a function of the same signature that calls fetch and parses the
// response into the type from src/api/types.ts. The hooks and screens do not change.
export { applyChange, deletePlan, proposeChange } from '@/api/mock/plan'
export { addIncident, failStop } from '@/api/mock/liveDay'
