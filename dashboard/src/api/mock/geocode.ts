import type { Geocode, GeocodeCandidate, LatLng } from '../types.ts'
import { hash } from './geo.ts'

// A fake geocoder for Yogyakarta. Known streets land on a line between two points, placed by house number.
// Ambiguous places come back as `check` with candidates, street names without a number as `check`, and
// anything else as `not_found`. It is deterministic: the same text always lands on the same point.

type Street = {
  name: string
  /** Lowercase text that identifies the street in an address. */
  key: string
  area: string
  from: LatLng
  to: LatLng
  /** How busy the street is with orders in the sample data: 3 for the city centre, 1 for the edges. */
  weight: number
}

const street = (name: string, key: string, area: string, from: [number, number], to: [number, number], weight: number): Street => ({
  name,
  key,
  area,
  from: { lat: from[0], lng: from[1] },
  to: { lat: to[0], lng: to[1] },
  weight,
})

export const streets: readonly Street[] = [
  street('Jl. Layur', 'layur', 'Mantrijeron, Yogyakarta', [-7.8168, 110.3556], [-7.8196, 110.3592], 1),
  street('Jl. Malioboro', 'malioboro', 'Sosromenduran, Yogyakarta', [-7.7895, 110.3661], [-7.7985, 110.3656], 3),
  street('Jl. Parangtritis', 'parangtritis', 'Mantrijeron, Yogyakarta', [-7.8155, 110.3642], [-7.8420, 110.3625], 3),
  street('Jl. Prawirotaman', 'prawirotaman', 'Mergangsan, Yogyakarta', [-7.8178, 110.3672], [-7.8186, 110.3752], 3),
  street('Jl. Suryodiningratan', 'suryodiningratan', 'Mantrijeron, Yogyakarta', [-7.8172, 110.3598], [-7.8180, 110.3670], 2),
  street('Jl. Wijilan', 'wijilan', 'Kraton, Yogyakarta', [-7.8036, 110.3658], [-7.8062, 110.3674], 2),
  street('Jl. Brigjen Katamso', 'katamso', 'Gondomanan, Yogyakarta', [-7.8002, 110.3702], [-7.8150, 110.3712], 3),
  street('Jl. Taman Siswa', 'taman siswa', 'Wirogunan, Yogyakarta', [-7.8002, 110.3772], [-7.8178, 110.3781], 3),
  street('Jl. Mataram', 'mataram', 'Suryatmajan, Yogyakarta', [-7.7930, 110.3690], [-7.7998, 110.3696], 2),
  street('Jl. Sosrowijayan', 'sosrowijayan', 'Sosromenduran, Yogyakarta', [-7.7921, 110.3628], [-7.7924, 110.3655], 2),
  street('Jl. Mangkubumi', 'mangkubumi', 'Gowongan, Yogyakarta', [-7.7832, 110.3666], [-7.7882, 110.3664], 2),
  street('Jl. Jenderal Sudirman', 'sudirman', 'Terban, Yogyakarta', [-7.7828, 110.3672], [-7.7834, 110.3800], 3),
  street('Jl. Cik Di Tiro', 'cik di tiro', 'Terban, Yogyakarta', [-7.7835, 110.3742], [-7.7742, 110.3746], 2),
  street('Jl. Kusumanegara', 'kusumanegara', 'Umbulharjo, Yogyakarta', [-7.8010, 110.3802], [-7.8002, 110.4030], 2),
  street('Jl. Gedongkuning', 'gedongkuning', 'Kotagede, Yogyakarta', [-7.8020, 110.4005], [-7.8195, 110.4018], 1),
  street('Jl. Kemasan', 'kemasan', 'Kotagede, Yogyakarta', [-7.8252, 110.3982], [-7.8290, 110.3992], 1),
  street('Jl. Imogiri Timur', 'imogiri timur', 'Giwangan, Yogyakarta', [-7.8255, 110.3858], [-7.8450, 110.3890], 1),
  street('Jl. Bantul', 'jl. bantul', 'Gedongkiwo, Yogyakarta', [-7.8160, 110.3532], [-7.8400, 110.3488], 2),
  street('Jl. HOS Cokroaminoto', 'cokroaminoto', 'Wirobrajan, Yogyakarta', [-7.7852, 110.3502], [-7.8095, 110.3500], 2),
  street('Jl. Kapten Tendean', 'tendean', 'Wirobrajan, Yogyakarta', [-7.7982, 110.3502], [-7.8000, 110.3598], 2),
  street('Jl. Wates', 'wates', 'Gamping, Sleman', [-7.8002, 110.3448], [-7.8040, 110.3200], 1),
  street('Jl. Godean', 'godean', 'Kricak, Yogyakarta', [-7.7832, 110.3498], [-7.7805, 110.3230], 1),
  street('Jl. Magelang', 'magelang', 'Karangwaru, Yogyakarta', [-7.7720, 110.3622], [-7.7500, 110.3560], 1),
  street('Jl. Monjali', 'monjali', 'Sinduadi, Sleman', [-7.7620, 110.3680], [-7.7440, 110.3690], 1),
  street('Jl. Palagan Tentara Pelajar', 'palagan', 'Sariharjo, Sleman', [-7.7560, 110.3718], [-7.7380, 110.3738], 1),
  street('Jl. Kaliurang', 'kaliurang', 'Caturtunggal, Sleman', [-7.7700, 110.3800], [-7.7460, 110.3880], 1),
  street('Jl. Colombo', 'colombo', 'Caturtunggal, Sleman', [-7.7722, 110.3782], [-7.7745, 110.3895], 2),
  street('Jl. Affandi', 'affandi', 'Caturtunggal, Sleman', [-7.7818, 110.3902], [-7.7620, 110.3912], 2),
  street('Jl. Laksda Adisucipto', 'adisucipto', 'Demangan, Yogyakarta', [-7.7830, 110.3902], [-7.7838, 110.4180], 1),
  street('Jl. Seturan Raya', 'seturan', 'Caturtunggal, Sleman', [-7.7702, 110.4052], [-7.7610, 110.4078], 1),
]

/** Places that match more than one spot. The geocoder places the first candidate and asks the dispatcher. */
const ambiguous: readonly { pattern: RegExp; reason: string; candidates: GeocodeCandidate[] }[] = [
  {
    pattern: /kaliurang\s*km\.?\s*7/,
    reason: '2 matches',
    candidates: [
      { address: 'Gg. Mawar, Jl. Kaliurang Km 7, Sleman', location: { lat: -7.7392, lng: 110.3905 } },
      { address: 'Jl. Kaliurang Km 7, Condongcatur, Sleman', location: { lat: -7.7418, lng: 110.3921 } },
    ],
  },
  {
    pattern: /griya asri/,
    reason: '2 matches',
    candidates: [
      { address: 'Perum Griya Asri B-12, Banguntapan, Bantul', location: { lat: -7.8262, lng: 110.4012 } },
      { address: 'Perum Griya Asri B-12, Sedayu, Bantul', location: { lat: -7.8205, lng: 110.3120 } },
    ],
  },
]

const normalize = (text: string) => text.toLowerCase().replace(/\bjalan\b/g, 'jl.').replace(/\s+/g, ' ').trim()

const houseNumber = (text: string): number | null => {
  const match = /\bno\.?\s*(\d+)/.exec(text) ?? /\b(\d{1,3})\b/.exec(text)
  return match ? Number(match[1]) : null
}

/** Where a house number lands along a street, with a little sideways jitter so points do not line up exactly. */
function along(s: Street, n: number): LatLng {
  const t = ((n * 37) % 100) / 100
  const jitter = ((hash(`${s.key}${n}`) % 1000) / 1000 - 0.5) * 0.0016
  return { lat: s.from.lat + (s.to.lat - s.from.lat) * t + jitter, lng: s.from.lng + (s.to.lng - s.from.lng) * t - jitter }
}

export function geocode(addressRaw: string): Geocode {
  const text = normalize(addressRaw)
  if (!text) return { status: 'not_found' }
  const place = ambiguous.find((a) => a.pattern.test(text))
  if (place) {
    const [first] = place.candidates
    return { status: 'check', address: first.address, location: first.location, reason: place.reason, candidates: place.candidates }
  }
  const s = streets.find((candidate) => text.includes(candidate.key))
  if (!s) return { status: 'not_found' }
  const n = houseNumber(text)
  if (n === null) {
    return { status: 'check', address: `${s.name}, ${s.area}`, location: along(s, 50), reason: 'street only, no number', candidates: [] }
  }
  return { status: 'ok', address: `${s.name} No.${n}, ${s.area}`, location: along(s, n) }
}

/** Address suggestions while the dispatcher types, such as for a depot. Empty when nothing matches. */
export function suggestAddresses(query: string, limit = 5): GeocodeCandidate[] {
  const text = normalize(query)
  if (text.length < 3) return []
  const n = houseNumber(text) ?? 12
  return streets
    .filter((s) => s.key.includes(text.replace(/^jl\.?\s*/, '').split(/[ ,]/)[0]) || text.includes(s.key))
    .slice(0, limit)
    .map((s) => ({ address: `${s.name} No.${n}, ${s.area}`, location: along(s, n) }))
}
