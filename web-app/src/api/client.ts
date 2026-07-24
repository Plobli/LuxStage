/**
 * client.js — schlanker HTTP-Client für den LuxStage-Server
 * Ersetzt pocketbase.js
 */
import { ref } from 'vue'

/** Reaktiver Online-Status — true wenn der LuxStage-Server erreichbar ist */
export const isOnline = ref<boolean>(true)

const DEV_SERVER = import.meta.env.VITE_SERVER_URL || null
export const BASE = (): string => localStorage.getItem('server_url') || DEV_SERVER || window.location.origin
const TOKEN_KEY = 'luxstage_token'

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t: string): void { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken(): void { localStorage.removeItem(TOKEN_KEY) }
export function isLoggedIn(): boolean { return !!getToken() }

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra }
  const t = getToken()
  if (t) h['Authorization'] = 'Bearer ' + t
  return h
}

async function request(method: string, path: string, body?: any): Promise<any> {
  const hadToken = !!getToken()
  const res = await fetch(BASE() + path, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  // Nur bei tatsächlich abgelaufener/ungültiger Session umleiten — nicht wenn
  // der Call von vornherein ohne Token lief (z. B. Pings auf öffentlichen
  // Seiten wie /register/confirm), sonst reißt der Redirect diese Seiten weg.
  if (res.status === 401) { clearToken(); if (hadToken && location.pathname !== '/login') location.href = '/login'; return }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get:    (path: string)        => request('GET', path),
  post:   (path: string, body: any)  => request('POST', path, body),
  put:    (path: string, body: any)  => request('PUT', path, body),
  patch:  (path: string, body: any)  => request('PATCH', path, body),
  delete: (path: string)        => request('DELETE', path),

  /** Synchrone URL mit langlebigem JWT — nur für Inline-Ressourcen (img src, SSE).
   *  Für einmalige Downloads (PDF, Backup) stattdessen downloadUrl() nutzen. */
  url: (path: string): string => BASE() + path + (path.includes('?') ? '&' : '?') + 'token=' + (getToken() || ''),

  /** Async URL mit kurzlebigem Einmal-Token (60s TTL) für Downloads (PDF, Backup).
   *  Verhindert, dass der langlebige JWT in Server-Logs landet. */
  downloadUrl: async (path: string): Promise<string> => {
    const res = await fetch(BASE() + '/api/auth/download-token', {
      method: 'POST',
      headers: headers(),
    })
    if (!res.ok) throw new Error('Download-Token konnte nicht ausgestellt werden')
    const { token } = await res.json()
    return BASE() + path + (path.includes('?') ? '&' : '?') + 'token=' + token
  },
}

export async function login(username: string, password: string): Promise<{ requiresPasswordChange: boolean }> {
  const res = await fetch(BASE() + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error('Ungültige Anmeldedaten')
  const { token, requiresPasswordChange } = await res.json()
  setToken(token)
  return { requiresPasswordChange: !!requiresPasswordChange }
}

export async function logout(): Promise<void> { clearToken() }

/** SaaS-Registrierung: legt eine unbestätigte Anmeldung an, Server verschickt Opt-In-Mail. */
export async function register(teamId: string, email: string, password: string): Promise<void> {
  const res = await fetch(BASE() + '/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ teamId, email, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
}

/** Fordert einen Passwort-Reset-Link an (neutrale Antwort, kein Existenz-Leak). */
export async function requestPasswordReset(email: string): Promise<void> {
  const res = await fetch(BASE() + '/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
}

/** Setzt ein neues Passwort mit dem Reset-Token aus der Mail. */
export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const res = await fetch(BASE() + '/api/auth/reset-password/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
}

/** Bestätigt die Registrierung über den Token aus der Opt-In-Mail. */
export async function confirmRegistration(token: string): Promise<{ tenantId: string, loginUrl: string }> {
  const res = await fetch(BASE() + '/api/register/confirm?token=' + encodeURIComponent(token))
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<any> {
  const res = await fetch(BASE() + '/api/auth/change-password', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function listUsers(): Promise<any[]> { return api.get('/api/users') }
export function createUser(username: string, role: string): Promise<any> { return api.post('/api/users', { username, role }) }
export function deleteUser(username: string): Promise<any> { return api.delete(`/api/users/${username}`) }

export function getSmtpConfig(): Promise<any> { return api.get('/api/smtp') }
export function saveSmtpConfig(cfg: object): Promise<any> { return api.post('/api/smtp', cfg) }
export function testSmtpConfig(to: string): Promise<any> { return api.post('/api/smtp/test', { to }) }

export async function resetPassword(username: string): Promise<any> {
  const res = await fetch(BASE() + '/api/auth/reset-password', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ username }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function setServerUrl(url: string): void {
  localStorage.setItem('server_url', url.replace(/\/$/, ''))
}

/**
 * Gemeinsame SSE-Verbindung pro Show.
 * Gibt { onChannels, onSections, onPresence, close } zurück.
 * Nutzt pro Verbindungsversuch ein frisches kurzlebiges Einmal-Token (statt
 * des langlebigen JWT), damit kein Dauer-Token in Server-/Proxy-Logs landet.
 * EventSource kann bei einem Einmal-Token nicht selbst reconnecten (das Token
 * ist nach dem ersten Connect verbraucht) — der Reconnect wird daher hier
 * manuell mit neuem Token durchgeführt.
 */
export function subscribeShow(showId: string, { onChannels, onSections, onPresence, onTowers, onBars }: { onChannels?: (data: any) => void, onSections?: (data: any) => void, onPresence?: (data: any) => void, onTowers?: (data: any) => void, onBars?: (data: any) => void } = {}): () => void {
  let es: EventSource | null = null
  let closed = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null

  async function connect(): Promise<void> {
    if (closed) return
    let url: string
    try {
      url = await api.downloadUrl(`/api/shows/${showId}/events?device=web`)
    } catch {
      if (!closed) retryTimer = setTimeout(connect, 3000)
      return
    }
    if (closed) return

    es = new EventSource(url)
    if (onChannels) es.addEventListener('channels-updated', (e: any) => onChannels(JSON.parse(e.data)))
    if (onSections) es.addEventListener('sections-updated', (e: any) => onSections(JSON.parse(e.data)))
    if (onPresence) es.addEventListener('presence-updated', (e: any) => onPresence(JSON.parse(e.data)))
    if (onTowers) es.addEventListener('towers-updated', (e: any) => onTowers(JSON.parse(e.data)))
    if (onBars) es.addEventListener('bars-updated', (e: any) => onBars(JSON.parse(e.data)))
    es.onerror = () => {
      es?.close()
      es = null
      if (!closed) retryTimer = setTimeout(connect, 3000)
    }
  }

  connect()

  return () => {
    closed = true
    if (retryTimer) clearTimeout(retryTimer)
    es?.close()
  }
}


