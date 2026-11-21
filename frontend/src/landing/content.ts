export const REPO_URL = 'https://github.com/danirisdiandita/Nextsci-Route-Optimization'

export type IconName =
  | 'route'
  | 'upload'
  | 'phone'
  | 'pin'
  | 'camera'
  | 'bell'
  | 'chart'
  | 'calendar'
  | 'server'
  | 'coins'
  | 'code'

export type Feature = { icon: IconName; title: string; body: string }

export type Step = { title: string; body: string }

export type RoadmapStatus = 'done' | 'next' | 'planned'

export type RoadmapItem = { title: string; status: RoadmapStatus }

export const nav = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Self-host', href: '#self-host' },
  { label: 'Roadmap', href: '#roadmap' },
]

export const hero = {
  pill: 'Early development. Follow along on GitHub',
  title: 'Plan every delivery route in minutes',
  lead: "Nextsci is open-source route planning for delivery and field-service teams. Import the day's orders, let the solver build the routes, and track every driver live.",
  primary: { label: 'Get started', href: `${REPO_URL}#quick-start` },
  secondary: { label: 'Star on GitHub', href: REPO_URL },
}

export const values: Feature[] = [
  { icon: 'server', title: 'Self-hosted', body: 'Run it on your own servers. Your customer data never leaves them.' },
  { icon: 'coins', title: 'No per-driver fees', body: 'Add drivers as your fleet grows. The software costs the same.' },
  { icon: 'code', title: 'Open source', body: 'Read the code, change the solver, and send improvements back.' },
]

export const features: Feature[] = [
  {
    icon: 'route',
    title: 'Route optimization',
    body: 'Assign stops to drivers and order each route. The solver respects time windows, vehicle capacity, shifts, and breaks.',
  },
  {
    icon: 'upload',
    title: 'Order import',
    body: 'Load the day from a CSV file or a spreadsheet, or push orders from your own system through the API.',
  },
  {
    icon: 'phone',
    title: 'Driver app',
    body: 'Drivers see their stops in order and open each address in the navigation app they already use.',
  },
  {
    icon: 'pin',
    title: 'Live tracking',
    body: 'Follow every vehicle on one map. See which stops are done and which routes run late.',
  },
  {
    icon: 'camera',
    title: 'Proof of delivery',
    body: 'Collect photos, signatures, and notes at the door. Each record attaches to its order.',
  },
  {
    icon: 'bell',
    title: 'Customer notifications',
    body: 'Send each customer an arrival window, and update it when the driver is on the way.',
  },
  {
    icon: 'chart',
    title: 'Reports',
    body: 'Compare planned and actual times, on-time rates, and distance per driver.',
  },
  {
    icon: 'calendar',
    title: 'Weekly planning',
    body: 'Schedule recurring visits across several days and balance the work between drivers.',
  },
]

export const steps: Step[] = [
  { title: 'Import your orders', body: 'Upload a file or connect your system. Each order has an address, a time window, and a size.' },
  { title: 'Optimize the routes', body: 'The solver splits the stops between drivers and finds the shortest order that keeps every promise.' },
  { title: 'Dispatch and track', body: 'Send each route to a phone. Watch progress on the map and react when plans change.' },
]

export const solver = {
  eyebrow: 'Solver',
  title: 'Routes that follow the rules of your business',
  body: 'A short route is easy. A short route that reaches every customer inside their window, fits the van, and ends before the shift does is the hard part. Describe your constraints once and the solver plans within them every day.',
  constraints: [
    { label: 'Time windows', value: '09:00–11:00' },
    { label: 'Vehicle capacity', value: '1,200 kg' },
    { label: 'Driver shift', value: '08:00–16:00' },
    { label: 'Break', value: '30 min after 4 h' },
    { label: 'Skills', value: 'Refrigerated' },
  ],
}

export const driverApp = {
  eyebrow: 'Driver app',
  title: 'The whole route in the driver’s pocket',
  body: 'Drivers start the day with their stops already in order. One tap opens navigation. Another records the delivery with a photo or a signature, and the dispatcher sees it at once.',
}

export const selfHost = {
  eyebrow: 'Self-host',
  title: 'Running in four commands',
  body: 'The development stack starts PostgreSQL, the API server, the web app, and the mobile dev server with Docker Compose.',
  commands: [
    `git clone ${REPO_URL}.git`,
    'cd Nextsci-Route-Optimization',
    'cp .env.example .env',
    'docker compose up --build',
  ],
}

export const roadmap: RoadmapItem[] = [
  { title: 'Monorepo with the API server, web app, and driver app', status: 'done' },
  { title: 'Docker Compose development stack', status: 'done' },
  { title: 'Data model for depots, vehicles, drivers, shifts, and stops', status: 'next' },
  { title: 'REST API for that data model', status: 'next' },
  { title: 'Order import from CSV files', status: 'planned' },
  { title: 'Route solver for capacity and time windows', status: 'planned' },
  { title: 'Map view to plan and edit routes', status: 'planned' },
  { title: 'Driver route list and navigation handoff', status: 'planned' },
  { title: 'Proof of delivery with photos and signatures', status: 'planned' },
  { title: 'Live driver location on the dispatcher map', status: 'planned' },
]

export const statusLabel: Record<RoadmapStatus, string> = {
  done: 'Done',
  next: 'Next',
  planned: 'Planned',
}

export const cta = {
  title: 'Build the route planner you want to use',
  body: 'Nextsci is early, so your ideas and code shape what it becomes.',
}
