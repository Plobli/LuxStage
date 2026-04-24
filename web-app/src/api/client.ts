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
  const res = await fetch(BASE() + path, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) { clearToken(); if (location.pathname !== '/login') location.href = '/login'; return }
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
  delete: (path: string)        => request('DELETE', path),

  /** Synchrone URL mit langlebigem JWT — nur für Inline-Ressourcen (img src, SSE).
   *  Für einmalige Downloads (PDF, Backup) stattdessen downloadUrl() nutzen. */
  url: (path: string): string => BASE() + path + '?token=' + (getToken() || ''),

  /** Async URL mit kurzlebigem Einmal-Token (60s TTL) für Downloads (PDF, Backup).
   *  Verhindert, dass der langlebige JWT in Server-Logs landet. */
  downloadUrl: async (path: string): Promise<string> => {
    const res = await fetch(BASE() + '/api/auth/download-token', {
      method: 'POST',
      headers: headers(),
    })
    if (!res.ok) throw new Error('Download-Token konnte nicht ausgestellt werden')
    const { token } = await res.json()
    return BASE() + path + '?token=' + token
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
 */
export function subscribeShow(showId: string, { onChannels, onSections, onPresence }: { onChannels?: (data: any) => void, onSections?: (data: any) => void, onPresence?: (data: any) => void } = {}): () => void {
  const url = BASE() + `/api/shows/${showId}/events?token=${getToken()}&device=web`
  const es = new EventSource(url)
  if (onChannels) es.addEventListener('channels-updated', (e: any) => onChannels(JSON.parse(e.data)))
  if (onSections) es.addEventListener('sections-updated', (e: any) => onSections(JSON.parse(e.data)))
  if (onPresence) es.addEventListener('presence-updated', (e: any) => onPresence(JSON.parse(e.data)))
  es.onerror = () => {} // reconnect automatically
  return () => es.close()
}


