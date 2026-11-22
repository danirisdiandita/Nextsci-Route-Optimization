export type Session = { access: string; refresh: string }

export type User = { email: string }

export type SignedIn = { session: Session; user: User }

const STORAGE_KEY = 'nextsci.session'
const API = '/api/v1/auth'

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

const isSession = (v: unknown): v is Session =>
  isRecord(v) && typeof v.access === 'string' && typeof v.refresh === 'string'

function loadSession(): Session | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return isSession(value) ? value : null
  } catch {
    return null
  }
}

function saveSession(session: Session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function signOut() {
  localStorage.removeItem(STORAGE_KEY)
}

async function post(path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return null
  }
}

async function getMe(access: string): Promise<User | 'unauthorized' | null> {
  try {
    const res = await fetch(`${API}/me/`, { headers: { Authorization: `Bearer ${access}` } })
    if (res.status === 401) return 'unauthorized'
    const body: unknown = await res.json()
    return res.ok && isRecord(body) && typeof body.email === 'string' ? { email: body.email } : null
  } catch {
    return null
  }
}

async function refresh(session: Session): Promise<Session | null> {
  const res = await post('/token/refresh/', { refresh: session.refresh })
  if (!res?.ok) return null
  const body: unknown = await res.json().catch(() => null)
  return isRecord(body) && typeof body.access === 'string' ? { ...session, access: body.access } : null
}

/** Loads the user for a session, refreshing the access token once if it expired. Null means sign in again. */
async function resume(session: Session): Promise<SignedIn | null> {
  const user = await getMe(session.access)
  if (user && user !== 'unauthorized') return { session, user }
  if (user !== 'unauthorized') return null
  const renewed = await refresh(session)
  if (!renewed) return null
  const retried = await getMe(renewed.access)
  return retried && retried !== 'unauthorized' ? { session: renewed, user: retried } : null
}

/** Restores the stored session on page load. Null means nobody is signed in. */
export async function restoreSession(): Promise<SignedIn | null> {
  const stored = loadSession()
  if (!stored) return null
  const signedIn = await resume(stored)
  if (signedIn) saveSession(signedIn.session)
  else signOut()
  return signedIn
}

/** Signs in and stores the session. Throws an Error with a message to show the user. */
export async function signIn(email: string, password: string): Promise<SignedIn> {
  const res = await post('/token/', { email, password })
  if (!res) throw new Error('Cannot reach the server. Check that the API server is running.')
  if (res.status === 401) throw new Error('The email or password is incorrect.')
  if (!res.ok) throw new Error(`The server could not sign you in (HTTP ${res.status}).`)
  const body: unknown = await res.json().catch(() => null)
  if (!isSession(body)) throw new Error('The server sent an unexpected response.')
  const signedIn = await resume(body)
  if (!signedIn) throw new Error('Signed in, but the server could not load your account.')
  saveSession(signedIn.session)
  return signedIn
}
