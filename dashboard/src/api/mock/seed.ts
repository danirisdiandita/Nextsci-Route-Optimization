import { formatWindow } from '../../lib/time.ts'
import type { Day, Depot, Driver, Order, OrderId, Plan, PlanId, TimeWindow, Vehicle } from '../types.ts'
import { emptyDb, type Db } from './db.ts'
import { geocode, streets } from './geocode.ts'
import { routesFromResult, rulesOf, solvePlan, storeRoutes } from './planStore.ts'

// The sample workspace: a food kitchen in Yogyakarta with ten drivers and 180 orders for one day. It matches
// the onboarding designs. Every value comes from a seeded generator, so each reset gives the same workspace.

const hm = (h: number, m = 0) => h * 60 + m
const w = (start: number, end: number): TimeWindow => ({ start, end })

/** mulberry32: a small seeded random generator. */
function random(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const depot: Depot = {
  id: 'depot_layur' as Depot['id'],
  name: 'Dapur Layur',
  address: 'Jl. Layur VII No.12, Mantrijeron, Yogyakarta',
  location: { lat: -7.818, lng: 110.3575 },
  hours: w(hm(8), hm(16)),
  loadMinutes: 10,
}

const vehicleId = (n: number) => `vehicle_s${String(n).padStart(2, '0')}` as Vehicle['id']
const driverId = (n: number) => `driver_s${String(n).padStart(2, '0')}` as Driver['id']

const vehicles: Vehicle[] = Array.from({ length: 10 }, (_, i) =>
  i === 2
    ? { id: vehicleId(i + 1), name: 'Car AB 1203 KD', kind: 'car', capacity: 40, depotId: depot.id }
    : { id: vehicleId(i + 1), name: `Motorbike AB ${3101 + i} KD`, kind: 'motorbike', capacity: 10, depotId: depot.id },
)

const lunch = { window: w(hm(11, 30), hm(13)), minutes: 30 }
const people: { name: string; hasApp: boolean; phone?: string | null; shift?: TimeWindow; active?: boolean; home?: string }[] = [
  { name: 'Budi Santoso', hasApp: true },
  { name: 'Sari Wulandari', hasApp: true },
  { name: 'Agus Pratama', hasApp: false, shift: w(hm(10), hm(18)) },
  { name: 'Dewi Lestari', hasApp: true, home: 'Jl. Taman Siswa No.20, Wirogunan, Yogyakarta' },
  { name: 'Rudi Hartono', hasApp: false },
  { name: 'Nina Kurniawati', hasApp: true },
  { name: 'Eko Prasetyo', hasApp: false, active: false },
  { name: 'Wahyu Nugroho', hasApp: false },
  { name: 'Fitri Handayani', hasApp: false, phone: null },
  { name: 'Joko Susilo', hasApp: false },
]

const drivers: Driver[] = people.map((p, i) => {
  const home = p.home ? geocode(p.home) : null
  return {
    id: driverId(i + 1),
    name: p.name,
    phone: p.phone === undefined ? `+62 812 0000 ${String(101 + i).padStart(4, '0')}` : p.phone,
    vehicleId: vehicles[i].id,
    shift: p.shift ?? w(hm(8), hm(16)),
    break: lunch,
    start: home && home.status !== 'not_found' ? { kind: 'home', address: home.address, location: home.location } : { kind: 'depot' },
    active: p.active ?? true,
    hasApp: p.hasApp,
  }
})

/** A row of the sample orders spreadsheet, as the kitchen would type it. */
type SampleRow = { customer: string; address: string; window: TimeWindow | null; boxes: number; phone: string; notes: string }

// The named stops that appear in the designs, including the addresses that need a check or are not found.
const namedRows: Omit<SampleRow, 'phone'>[] = [
  { customer: 'Warung Pojok', address: 'Jl. Parangtritis No.45, Yogyakarta', window: w(hm(10), hm(12)), boxes: 3, notes: 'Titip di satpam' },
  { customer: 'Toko Sinar Jaya', address: 'Jl. Kaliurang km 7 gg. Mawar', window: null, boxes: 2, notes: '' },
  { customer: 'Bu Ratna', address: 'Perum Griya Asri B-12', window: w(hm(12), hm(13)), boxes: 2, notes: '' },
  { customer: 'Kopi Lor', address: 'Jl. Magelang', window: w(hm(12), hm(12, 30)), boxes: 3, notes: '' },
  { customer: 'Pak Hadi', address: 'belakang masjid', window: null, boxes: 1, notes: 'Telepon dulu' },
  { customer: 'Gudeg Ibu Widodo', address: 'Jl. Wijilan No.8, Yogyakarta', window: null, boxes: 4, notes: '' },
  { customer: 'Apotek Saras Dewi', address: 'Jl. Palagan Tentara Pelajar No.21, Sleman', window: null, boxes: 1, notes: '' },
  { customer: 'Kedai Kanjeng Mami', address: 'Jl. Prawirotaman No.17, Yogyakarta', window: w(hm(11), hm(13)), boxes: 3, notes: 'Pintu samping' },
  { customer: 'Laundry Bersih', address: 'Jl. Taman Siswa No.60, Yogyakarta', window: w(hm(13), hm(14)), boxes: 2, notes: '' },
  { customer: 'Apotek Sehat', address: 'Jl. Jenderal Sudirman No.33, Yogyakarta', window: w(hm(14), hm(16)), boxes: 1, notes: '' },
  { customer: "Dunkin'", address: 'Jl. Malioboro No.52, Yogyakarta', window: w(hm(10), hm(14)), boxes: 5, notes: '' },
]

const prefixes = ['Warung', 'Toko', 'Kedai', 'Apotek', 'Laundry', 'Kopi', 'Bakmi', 'Angkringan', 'Salon', 'Klinik', 'Kantor', 'Rumah Makan', 'Bengkel', 'Kos']
const names = [
  'Sinar Pagi', 'Makmur', 'Barokah', 'Sejahtera', 'Bu Tini', 'Pak Darmo', 'Sumber Rejeki', 'Lestari', 'Abadi', 'Sentosa',
  'Mekar Sari', 'Melati', 'Kenanga', 'Cempaka', 'Mbah Lindu', 'Bu Sri', 'Pak Slamet', 'Rejeki', 'Jaya Abadi', 'Mulya',
  'Kartika', 'Mawar', 'Anugrah', 'Tentrem', 'Ngudi Rejeki', 'Pak Tono', 'Bu Yanti', 'Sido Mukti', 'Gemah Ripah', 'Wijaya',
]
const windows = [w(hm(9), hm(11)), w(hm(10), hm(12)), w(hm(11), hm(13)), w(hm(12), hm(14)), w(hm(13), hm(15)), w(hm(8), hm(12))]
const notes = ['Titip di satpam', 'Telepon dulu', 'Pintu samping', 'Lantai 2', 'Jangan dibanting']
const boxes = [1, 1, 1, 2, 2, 2, 2, 3, 3, 4]

/** The 180 rows of the sample orders spreadsheet, the same on every call. */
export function sampleRows(): SampleRow[] {
  const rand = random(21_11_2026)
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]
  const weighted = streets.flatMap((s) => Array<typeof s>(s.weight).fill(s))
  const used = new Set(namedRows.map((r) => r.customer))
  const rows: SampleRow[] = namedRows.map((r, i) => ({ ...r, phone: `0812 0000 ${String(201 + i).padStart(4, '0')}` }))
  while (rows.length < 180) {
    const customer = `${pick(prefixes)} ${pick(names)}`
    if (used.has(customer)) continue
    used.add(customer)
    const s = pick(weighted)
    const area = s.area.split(', ').at(-1)
    rows.push({
      customer,
      address: `${s.name} No.${1 + Math.floor(rand() * 150)}, ${area}`,
      window: rand() < 0.3 ? pick(windows) : null,
      boxes: pick(boxes),
      phone: `0812 0000 ${String(201 + rows.length).padStart(4, '0')}`,
      notes: rand() < 0.15 ? pick(notes) : '',
    })
  }
  return rows
}

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value)

/** The sample orders as the CSV file a kitchen would upload, with Indonesian headers. */
export function sampleOrdersCsv(): string {
  const header = ['Nama Pelanggan', 'Alamat', 'Jam Antar', 'Jumlah Box', 'No HP', 'Catatan']
  const lines = sampleRows().map((r) =>
    [r.customer, r.address, r.window ? formatWindow(r.window).replaceAll(':', '.').replace('–', '-') : '', String(r.boxes), r.phone, r.notes]
      .map(csvCell)
      .join(','),
  )
  return [header.join(','), ...lines].join('\n') + '\n'
}

export const SAMPLE_CSV_NAME = 'orders-21-nov.csv'

/** The sample workspace with a draft plan for `day`, solved with every active driver. */
export function sampleDb(day: Day, createdAt = new Date().toISOString()): Db {
  const db = emptyDb()
  db.depot = [depot]
  db.vehicle = vehicles.map((v) => ({ ...v }))
  db.driver = drivers.map((d) => ({ ...d }))
  db.order = sampleRows().map(
    (r, i): Order => ({
      id: `order_s${String(i + 1).padStart(3, '0')}` as OrderId,
      customer: r.customer,
      phone: r.phone,
      addressRaw: r.address,
      geocode: geocode(r.address),
      quantity: r.boxes,
      serviceMinutes: null,
      window: r.window,
      notes: r.notes,
      importId: null,
    }),
  )
  const plan: Plan = {
    id: 'plan_sample' as PlanId,
    day,
    depotId: depot.id,
    driverIds: db.driver.filter((d) => d.active).map((d) => d.id),
    goal: 'min_time',
    allowReloads: true,
    strictWindows: true,
    serviceMinutes: 4,
    pins: [],
    status: 'draft',
    version: 1,
    notify: { customers: false, onChange: true },
    createdAt,
  }
  db.plan = [plan]
  storeRoutes(db, plan.id, routesFromResult(db, plan.id, solvePlan(db, plan, rulesOf(plan))))
  db.day_clock = { kind: 'paused', minute: hm(8), speed: 10 }
  return db
}
