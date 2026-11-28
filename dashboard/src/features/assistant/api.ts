// The calls this feature makes. Today they run against the mock server in src/api/mock/. To move one to the
// backend, replace its re-export with a function of the same signature that calls fetch and parses the
// response into the type from src/api/types.ts. The hooks and screens do not change.
export { clearAgentMessages, listAgentMessages } from '@/api/mock/agentMessage'
export { askAgent, suggestionsFor, watchDay, type AgentFile, type AgentTurn } from '@/api/mock/agent'
export { getToday, incidentMessageId, isIncidentMessage, goalLabels, type OrderReview, type SendSummary, type TodayStage, type TodayView } from '@/api/mock/agentToday'
export { updateDriver } from '@/api/mock/driver'
export { describeBusiness, describeDepot, describeFleet, driverRange, fleetSummary, businessProfiles, vehicleLabels, type SetupDraft } from '@/api/mock/agentSetup'
export { businesses, type Business } from '@/api/mock/agentLanguage'
export { routeProgress, type RouteProgress } from '@/api/mock/clock'
