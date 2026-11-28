import type { Driver, DriverId, Minute, Order, OrderId, PlanGoal, TimeWindow, VehicleKind } from '../types.ts'

// What the dispatch agent understands. There is no language model: a message is split into clauses, and each
// clause goes through a table of rules in order. The first rule that matches gives the clause's intent.
// English and Indonesian phrasings both work, as do the time formats a kitchen types: "08:00 to 16:00",
// "08.00-16.00", "8am to 4pm", "jam 8 sampai 16".

export const businesses = ['food', 'parcel', 'grocery', 'general'] as const
export type Business = (typeof businesses)[number]

/** What a description says about a break. Each part is missing when the description does not say it. */
export type BreakPatch = { minutes?: number; window?: TimeWindow; around?: Minute }

/** What one description says about the operation. A field it does not mention stays undefined. */
export type SetupPatch = {
  business?: Business
  address?: string
  drivers?: number
  vehicleKind?: VehicleKind
  capacity?: number
  shift?: TimeWindow
  /** Null when the description says there is no break. */
  break?: BreakPatch | null
}

export type Intent =
  | { kind: 'describe_operation'; setup: SetupPatch }
  | { kind: 'confirm' }
  | { kind: 'cancel' }
  | { kind: 'use_sample' }
  /** Files came with the message. interpretMessage adds it; no words map to it. */
  | { kind: 'import_orders' }
  | { kind: 'fix_addresses' }
  /** Null: the stop the agent asked about. */
  | { kind: 'skip_order'; orderId: OrderId | null }
  | { kind: 'pin_on_map'; orderId: OrderId | null }
  | { kind: 'allow_reloads'; allow: boolean }
  | { kind: 'set_goal'; goal: PlanGoal }
  | { kind: 'finish_earlier' }
  | { kind: 'plan' }
  | { kind: 'remove_driver_today'; driverId: DriverId }
  | { kind: 'move_stop'; orderId: OrderId; toDriverId: DriverId }
  /** Keep a stop with a driver whenever the plan is solved again. */
  | { kind: 'pin_rule'; orderId: OrderId; driverId: DriverId }
  /** The answer to "just today, or always?". */
  | { kind: 'set_scope'; scope: 'today' | 'always' }
  | { kind: 'apply' }
  | { kind: 'discard' }
  | { kind: 'send_plan' }
  | { kind: 'send_now' }
  | { kind: 'start_day' }
  | { kind: 'notify_customers' }
  | { kind: 'explain' }
  | { kind: 'help' }
  | { kind: 'unsupported'; topic: 'toll_roads' }
  /** The clause names a stop or driver that does not exist. */
  | { kind: 'missing'; noun: 'stop' | 'driver'; text: string }
  | { kind: 'unknown'; text: string }

export type IntentKind = Intent['kind']

/** The names the agent can resolve: the workspace's drivers and stops. */
export type InterpretContext = { drivers: Pick<Driver, 'id' | 'name'>[]; orders: Pick<Order, 'id' | 'customer'>[] }

export const emptyContext: InterpretContext = { drivers: [], orders: [] }

type Clause = { text: string; norm: string }
type Rule = (clause: Clause, ctx: InterpretContext) => Intent | null

/** Lowercase, straight quotes, single spaces, no trailing punctuation, no leading "and" or "please". */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.!?,;:]+$/, '')
    .replace(/^(?:(?:and|also|then|so|but|please|pls|ok|okay|dan|juga|lalu|terus|tolong)[\s,]+)+/, '')
}

/** A name as a key for matching: no punctuation, single spaces. */
const nameKey = (text: string) => normalize(text).replace(/['".,()]/g, '').replace(/\s+/g, ' ')

/** Splits a message into clauses at sentence ends and line breaks. "Jl." and "No.12" do not end a sentence. */
export function splitClauses(text: string): string[] {
  return text
    .split(/\n+|;|(?<!\b(?:jl|jln|no|gg|km|st|rd|dr|mr|mrs|ms|ir|pt|cv|perum|blok|kec|kel|kab))[.!?]+(?=\s|$)/i)
    .map((c) => c.trim())
    .filter((c) => /[\p{L}\d]/u.test(c))
}

// ---------------------------------------------------------------------------------------------------------
// Numbers, times, names

const numberWords: [string, number][] = [
  ['dua belas', 12],
  ['sebelas', 11],
  ['sepuluh', 10],
  ['sembilan', 9],
  ['delapan', 8],
  ['tujuh', 7],
  ['enam', 6],
  ['lima', 5],
  ['empat', 4],
  ['tiga', 3],
  ['dua', 2],
  ['satu', 1],
  ['twelve', 12],
  ['eleven', 11],
  ['twenty', 20],
  ['fifteen', 15],
  ['ten', 10],
  ['nine', 9],
  ['eight', 8],
  ['seven', 7],
  ['six', 6],
  ['five', 5],
  ['four', 4],
  ['three', 3],
  ['two', 2],
  ['one', 1],
]
const NUM = `(\\d{1,3}|${numberWords.map(([w]) => w).join('|')})`
const toNumber = (token: string) => (/^\d+$/.test(token) ? Number(token) : (numberWords.find(([w]) => w === token)?.[1] ?? NaN))

const TIME = String.raw`(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|pagi|siang|sore|malam)?`
const RANGE_SEP = String.raw`\s*(?:to|until|till|-|–|—|sampai|s\/d|hingga|and|sd)\s*`
const rangePattern = new RegExp(`(?:(from|jam|pukul|between|antara|dari|shift|shifts|work|kerja|open|buka)\\s+)?${TIME}${RANGE_SEP}${TIME}`)

function clock(hour: string, minute: string | undefined, suffix: string | undefined): Minute | null {
  let h = Number(hour)
  const m = minute ? Number(minute) : 0
  const s = suffix?.replace(/\./g, '')
  if (s === 'pm' || s === 'sore' || s === 'malam') h = h < 12 ? h + 12 : h
  else if (s === 'siang') h = h < 11 ? h + 12 : h
  else if (s === 'am' && h === 12) h = 0
  return h < 24 && m < 60 ? h * 60 + m : null
}

/** "08:00 to 16:00", "8am-4pm", "jam 8 sampai 16", "from 8 to 4". Null when the text holds no time range. */
export function findTimeRange(text: string): TimeWindow | null {
  const match = rangePattern.exec(text)
  if (!match) return null
  const [, cue, h1, m1, s1, h2, m2, s2] = match
  // "1 to 2 boxes" is not a time: a bare range needs minutes, am/pm, or a cue such as "from".
  if (!cue && !m1 && !m2 && !s1 && !s2) return null
  const start = clock(h1, m1, s1)
  let end = clock(h2, m2, s2)
  if (start === null || end === null) return null
  // "from 8 to 4" means the afternoon.
  if (end <= start && end < 12 * 60) end += 12 * 60
  return end > start ? { start, end } : null
}

/** The driver a clause names: "Driver 003", "driver 3", or a name such as "Budi". */
function findDriver(norm: string, drivers: InterpretContext['drivers']): DriverId | 'missing' | null {
  const numbered = /\bdriver\s*#?\s*0*(\d{1,3})\b/.exec(norm)
  if (numbered) {
    const n = Number(numbered[1])
    const named = drivers.find((d) => nameKey(d.name) === `driver ${String(n).padStart(3, '0')}` || nameKey(d.name) === `driver ${n}`)
    return named?.id ?? drivers[n - 1]?.id ?? 'missing'
  }
  const key = ` ${nameKey(norm)} `
  const full = drivers.filter((d) => key.includes(` ${nameKey(d.name)} `)).sort((a, b) => b.name.length - a.name.length)[0]
  if (full) return full.id
  const first = drivers.find((d) => {
    const word = nameKey(d.name).split(' ')[0]
    return word.length >= 3 && word !== 'driver' && key.includes(` ${word} `)
  })
  return first?.id ?? null
}

/** The stop a clause names, by its customer. The longest name wins, so "Toko Makmur Jaya" beats "Toko Makmur". */
function findOrder(norm: string, orders: InterpretContext['orders']): InterpretContext['orders'][number] | null {
  const key = ` ${nameKey(norm)} `
  const match = orders
    .filter((o) => nameKey(o.customer).length >= 3 && key.includes(` ${nameKey(o.customer)} `))
    .sort((a, b) => b.customer.length - a.customer.length)[0]
  return match ?? null
}

// ---------------------------------------------------------------------------------------------------------
// The description of an operation

const businessWords: [Business, RegExp][] = [
  ['food', /\b(?:food|kitchen|catering|caterer|restaurant|meals?|lunch boxes|makanan|katering|dapur|warung|nasi|kuliner)\b/],
  ['grocery', /\b(?:grocery|groceries|supermarket|minimarket|sayur|sembako|fresh produce)\b/],
  ['parcel', /\b(?:parcels?|packages?|courier service|logistics|ekspedisi|paket|kiriman)\b/],
  ['general', /\b(?:general|other|lainnya|umum)\b.*\b(?:business|delivery|usaha)\b/],
]

const vehicleWords: [VehicleKind, string][] = [
  ['motorbike', 'motorbikes?|motorcycles?|motor ?bikes?|bikes?|scooters?|sepeda motor|motor|ojek'],
  ['car', 'cars?|mobil'],
  ['van', 'vans?|trucks?|truk|pickups?|pick-ups?|lorry|lorries'],
]
const VEHICLE = vehicleWords.map(([, w]) => w).join('|')
const vehicleKindOf = (word: string): VehicleKind | undefined => vehicleWords.find(([, w]) => new RegExp(`^(?:${w})$`).test(word))?.[0]

const BOXES = 'boxes|box|kotak|parcels?|paket|items?|bags?|orders?|portions?|porsi|kantong'
const capacityPatterns = [
  new RegExp(`\\b(?:carr(?:y|ies)|holds?|fits?|takes?|capacity(?: of| is)?|muat(?:an)?|bawa|membawa|kapasitas(?:nya)?)\\s+(?:up to\\s+|about\\s+|around\\s+|maks(?:imal)?\\s+|sampai\\s+)?(\\d{1,3})\\s*(?:${BOXES})\\b`),
  new RegExp(`\\b(\\d{1,3})\\s*(?:${BOXES})\\s+(?:each|apiece|per (?:${VEHICLE}|vehicle|trip|driver|rider)|masing-masing|sekali jalan)\\b`),
]

const ADDRESS_START = String.raw`(?:jl|jln|jalan|gg|gang|perum|perumahan|komplek|ruko)\.?\s+`
const ADDRESS_STOP = /\b(?:\d+\s+(?:drivers?|kurir|riders?)|drivers?|motor|bikes?|cars?|vans?|shift|break|lunch|istirahat|boxes|carr|each|with|dengan|from \d|jam \d)\b|\d{1,2}[:.]\d{2}/

/** The depot address: "at Jl. Layur VII, Yogyakarta", "depot is at ...", "alamat ...". Keeps the original case. */
function findAddress(text: string): string | undefined {
  const lower = text.toLowerCase()
  const prefixed = new RegExp(`\\b${ADDRESS_START}`).exec(lower)
  const cued = /\b(?:depot|kitchen|warehouse|gudang|dapur|base|address|alamat|located|based)\b(?:\s+(?:is|are|di|at|in|on))*\s*:?\s+(?=\S)/.exec(lower)
  const at = prefixed?.index ?? (cued ? cued.index + cued[0].length : -1)
  if (at < 0) return undefined
  const segments = text.slice(at).split(/,\s*/)
  const kept: string[] = []
  for (const [i, segment] of segments.entries()) {
    const stop = ADDRESS_STOP.exec(segment.toLowerCase())
    const part = (stop ? segment.slice(0, stop.index) : segment).replace(/[\s.]+$/, '').replace(/\s+(?:and|dan|with)$/i, '')
    if (part) kept.push(part)
    if (stop || i >= 3) break
  }
  const address = kept.join(', ').trim()
  return address.length >= 4 ? address : undefined
}

const BREAK_WORD = /\b(?:lunch|break|rest|istirahat|makan siang|ishoma)\b/

/** The part of a clause about the break, from the nearest "with", "and", or comma before the break word. */
function breakSegment(norm: string): { segment: string; rest: string } | null {
  const word = BREAK_WORD.exec(norm)
  if (!word) return null
  const before = norm.slice(0, word.index)
  const boundary = Math.max(before.lastIndexOf(','), ...[' with ', ' and ', ' plus ', ' dengan ', ' dan '].map((b) => before.lastIndexOf(b)))
  const from = boundary < 0 ? 0 : boundary
  const comma = norm.indexOf(',', word.index)
  const to = comma < 0 ? norm.length : comma
  return { segment: norm.slice(from, to), rest: norm.slice(0, from) + norm.slice(to) }
}

function findBreak(segment: string): BreakPatch | null {
  if (/\b(?:no|without|tanpa|tidak ada)\b.*\b(?:lunch|break|istirahat)/.test(segment)) return null
  const patch: BreakPatch = {}
  const minutes = /(\d{1,3})\s*-?\s*(?:min(?:ute)?s?|menit)\b/.exec(segment)
  if (minutes) patch.minutes = Number(minutes[1])
  else if (/\bhalf[- ]an?[- ]hour|\bhalf[- ]hour|\bsetengah jam/.test(segment)) patch.minutes = 30
  else if (/\b(?:an?|one|1|satu)[- ]hour\b|\bsejam\b|\b1 jam\b/.test(segment)) patch.minutes = 60
  const window = findTimeRange(segment.replace(/(\d{1,3})\s*-?\s*(?:min(?:ute)?s?|menit)\b/, ''))
  if (window) patch.window = window
  else if (/\b(?:noon|midday|tengah hari|siang)\b/.test(segment)) patch.around = 12 * 60
  else {
    const at = new RegExp(`\\b(?:around|about|at|near|sekitar|jam|pukul)\\s+${TIME}`).exec(segment)
    const t = at && clock(at[1], at[2], at[3])
    if (t !== null && t !== undefined) patch.around = t
  }
  return patch
}

/** Every field a clause gives about the operation. Empty when it says nothing about it. */
export function readSetup(text: string): SetupPatch {
  const norm = normalize(text)
  const patch: SetupPatch = {}
  const business = businessWords.find(([, re]) => re.test(norm))
  if (business) patch.business = business[0]
  const address = findAddress(text.trim().replace(/[.!?]+$/, ''))
  if (address) patch.address = address
  const drivers = new RegExp(`\\b${NUM}\\s+(?:delivery\\s+)?(?:drivers?|riders?|couriers?|kurir|sopir|supir|pengemudi|pengantar)\\b`).exec(norm)
  const vehicles = new RegExp(`\\b${NUM}\\s+(?:delivery\\s+)?(${VEHICLE})\\b`).exec(norm)
  const count = drivers ? toNumber(drivers[1]) : vehicles ? toNumber(vehicles[1]) : NaN
  if (Number.isInteger(count) && count > 0) patch.drivers = count
  const kind = new RegExp(`\\b(${VEHICLE})\\b`).exec(norm)
  if (kind) patch.vehicleKind = vehicleKindOf(kind[1])
  for (const re of capacityPatterns) {
    const m = re.exec(norm)
    if (m) {
      patch.capacity = Number(m[1])
      break
    }
  }
  const split = breakSegment(norm)
  if (split) patch.break = findBreak(split.segment)
  const shift = findTimeRange(split ? split.rest : norm)
  if (shift) patch.shift = shift
  return patch
}

// ---------------------------------------------------------------------------------------------------------
// The rules

/** The whole clause is one of these phrases, maybe with "please" or "thanks" after it. */
const whole = (phrases: string) => new RegExp(`^(?:${phrases})(?:[\\s,!]+(?:please|thanks|thank you|ya|dong|aja|saja))*$`)

const fixed =
  (re: RegExp, intent: Intent): Rule =>
  ({ norm }) =>
    re.test(norm) ? intent : null

const MOVE_CUE = /\b(?:should go|go(?:es)? with|move|give|assign|put|hand|swap|pindah\w*|kasih|berikan|serahkan|antar\w*|take|takes|deliver|handle)\b/
const PIN_CUE = /\b(?:always|pin|keep|stays?|tetap|selalu)\b/
const OFF_CUE = /\b(?:is off|are off|off today|sick|ill|absent|away|on leave|not (?:working|coming|available|in)|can'?t (?:work|come)|libur|sakit|izin|cuti|tidak masuk|gak masuk|nggak masuk|ga masuk)\b|\b(?:take|remove|drop|without|tanpa)\b/

/** Stop and driver edits: skip, pin, move, or take a driver off. They need names from the workspace. */
const edits: Rule = ({ norm }, ctx) => {
  const named = findOrder(norm, ctx.orders)
  const order = named?.id ?? null
  if (/\b(?:skip|lewati|lewatkan)\b|\bleave (?:it|them|.+) out\b/.test(norm)) return { kind: 'skip_order', orderId: order }
  if (/\bpin\b.*\b(?:map|peta)\b|\bdrop a pin\b/.test(norm)) return { kind: 'pin_on_map', orderId: order }
  // A customer such as "Warung Mekar Sari" must not read as the driver Sari.
  const driver = findDriver(named ? nameKey(norm).replace(nameKey(named.customer), ' ') : norm, ctx.drivers)
  const wantsMove = MOVE_CUE.test(norm) || PIN_CUE.test(norm)
  if (order && driver && driver !== 'missing' && wantsMove) {
    return PIN_CUE.test(norm) ? { kind: 'pin_rule', orderId: order, driverId: driver } : { kind: 'move_stop', orderId: order, toDriverId: driver }
  }
  if (driver && driver !== 'missing' && !order && OFF_CUE.test(norm)) return { kind: 'remove_driver_today', driverId: driver }
  if (driver === 'missing' && (wantsMove || OFF_CUE.test(norm))) {
    return { kind: 'missing', noun: 'driver', text: /\bdriver\s*#?\s*\d{1,3}\b/.exec(norm)![0].replace(/\b\w/g, (c) => c.toUpperCase()) }
  }
  if (driver && !order && /\b(?:move|give|assign|put|pindah\w*|kasih|berikan)\b/.test(norm)) {
    const stop = /\b(?:move|give|assign|put|pindahkan|kasih|berikan)\s+(.+?)\s+(?:to|with|ke|on)\s+/.exec(norm)
    if (stop) return { kind: 'missing', noun: 'stop', text: stop[1] }
  }
  return null
}

const goal: Rule = ({ norm }) => {
  if (/\b(?:fewer|fewest|less|least|minimum|minimal|min|sedikit|kurangi)\b.*\b(?:drivers?|kurir|sopir|routes?|rute)\b/.test(norm)) {
    return { kind: 'set_goal', goal: 'min_drivers' }
  }
  if (/\b(?:similar|same|equal|even|balanced?|fair)\b.*\b(?:hours?|work|load|days?|shifts?)\b|\bbalance\b|\bseimbang\b|\bmerata\b|\badil\b/.test(norm)) {
    return { kind: 'set_goal', goal: 'balance' }
  }
  if (/\bfinish(?:es)? (?:earlier|sooner)\b|\b(?:home|back|done) earlier\b|\bselesai lebih (?:cepat|awal)\b|\blebih awal\b/.test(norm)) {
    return { kind: 'finish_earlier' }
  }
  if (/\b(?:fewest|shortest|least|less|minimum)\b.*\b(?:km|kilomet\w*|distance|driving|time|jarak|waktu)\b|\bfastest\b|\bquickest\b|\btercepat\b/.test(norm)) {
    return { kind: 'set_goal', goal: 'min_time' }
  }
  return null
}

const reloads: Rule = ({ norm }) => {
  if (/\b(?:one|single|1) trip\b|\bno reloads?\b|\bwithout reload\w*|\bignore capacity\b|\bsekali jalan\b|\btanpa isi ulang\b/.test(norm)) {
    return { kind: 'allow_reloads', allow: false }
  }
  if (/\breload\w*|\bcomes? back\b|\breturns? to (?:the )?(?:depot|kitchen|base)\b|\b(?:several|multiple|more|many) trips\b|\bbalik (?:ke )?(?:dapur|depot|gudang)\b|\bisi ulang\b|\bbolak-?balik\b/.test(norm)) {
    return { kind: 'allow_reloads', allow: true }
  }
  return null
}

const describe: Rule = ({ text }) => {
  const setup = readSetup(text)
  return Object.keys(setup).length ? { kind: 'describe_operation', setup } : null
}

/** In order: the first rule that matches a clause gives its intent. */
const rules: Rule[] = [
  fixed(
    whole(
      'yes|yep|yeah|yup|ok|okay|sure|confirm|confirmed|correct|right|continue|go ahead|do it|sounds good|looks (?:right|good|fine)(?:,? (?:continue|save it))?|save it|lanjut|lanjutkan|ya|iya|oke|betul|benar|setuju|sip',
    ),
    { kind: 'confirm' },
  ),
  fixed(whole('no|nope|not yet|cancel|back|go back|back to the plan|wait|hold on|nanti|nanti dulu|batal|tidak|belum|jangan dulu'), { kind: 'cancel' }),
  fixed(/^(?:apply(?: the)?(?: change)?|apply it|reassign(?: (?:the|those|them|\d+))?(?: stops?)?|terapkan)$/, { kind: 'apply' }),
  fixed(/^(?:discard(?: it| the change)?|leave it(?: as it is)?|reject(?: it)?|keep it as it is|don'?t (?:apply|change) (?:it|anything)|biarkan(?: saja)?)$/, { kind: 'discard' }),
  fixed(/\b(?:text|tell|message|notify|warn|kabari|beritahu)\b.*\b(?:customers?|pelanggan)\b/, { kind: 'notify_customers' }),
  fixed(/\b(?:send|kirim)\b.*\bnow\b|\bkirim sekarang\b|^yes,? send\b/, { kind: 'send_now' }),
  fixed(/\b(?:send|kirim|dispatch)\b/, { kind: 'send_plan' }),
  fixed(/\b(?:start|begin|mulai)\b.*\b(?:day|hari|delivering|deliveries|routes?)\b|\bgo live\b/, { kind: 'start_day' }),
  fixed(whole('just today|only today|today only|just for today|hari ini saja|cuma hari ini'), { kind: 'set_scope', scope: 'today' }),
  fixed(whole('always|every day|every time|from now on|selalu|seterusnya'), { kind: 'set_scope', scope: 'always' }),
  fixed(/\b(?:try|use|load)\b.*\bsample\b|\bdata contoh\b/, { kind: 'use_sample' }),
  fixed(/\bfix\b.*\baddress|\bperbaiki alamat/, { kind: 'fix_addresses' }),
  fixed(/\btolls?\b|\bjalan tol\b|\btol\b/, { kind: 'unsupported', topic: 'toll_roads' }),
  edits,
  goal,
  reloads,
  fixed(/^(?:plan|re-?plan|plan (?:it|again|today|now|the day|\d+ (?:orders|stops))|make (?:the |a )?plan|build (?:the |a )?plan|solve(?: it)?|buat rencana|rencanakan|susun rute)\b/, { kind: 'plan' }),
  fixed(/\bwhy\b|\bexplain\b|\bkenapa\b|\bmengapa\b|\breasons?\b|\bhow come\b/, { kind: 'explain' }),
  fixed(/^(?:help|hi|hello|hey|halo|hai|what can you do|what do you do|apa yang bisa)\b/, { kind: 'help' }),
  describe,
]

/** The intent of one clause. Never throws: text no rule matches is `unknown`. */
export function interpret(text: string, ctx: InterpretContext): Intent {
  const clause = { text, norm: normalize(text) }
  for (const rule of rules) {
    const intent = rule(clause, ctx)
    if (intent) return intent
  }
  return { kind: 'unknown', text: text.trim() }
}

/**
 * The intents of a whole message, in order. Clauses that describe the operation merge into one intent, so
 * "10 drivers on motorbikes. Each bike carries 10 boxes." is one description. Attached files come first.
 */
export function interpretMessage(text: string, ctx: InterpretContext, { files = 0 }: { files?: number } = {}): Intent[] {
  const intents: Intent[] = files > 0 ? [{ kind: 'import_orders' }] : []
  for (const clause of splitClauses(text)) {
    const intent = interpret(clause, ctx)
    const last = intents.at(-1)
    if (intent.kind === 'describe_operation' && last?.kind === 'describe_operation') last.setup = { ...last.setup, ...intent.setup }
    else intents.push(intent)
  }
  // Filler next to a request, such as "they know the owner" or "here you go" with a file, is not a question.
  const known = intents.filter((i) => i.kind !== 'unknown')
  return known.length ? known : intents.slice(0, 1)
}
