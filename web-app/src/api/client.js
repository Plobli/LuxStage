/**
 * client.js — schlanker HTTP-Client für den LuxStage-Server
 * Ersetzt pocketbase.js
 */

const DEV_SERVER = import.meta.env.VITE_SERVER_URL || null
const BASE = () => localStorage.getItem('server_url') || DEV_SERVER || window.location.origin
const TOKEN_KEY = 'luxstage_token'

export function getToken() { return localStorage.getItem(TOKEN_KEY) }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t) }
export function clearToken() { localStorage.removeItem(TOKEN_KEY) }
export function isLoggedIn() { return !!getToken() }

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra }
  const t = getToken()
  if (t) h['Authorization'] = 'Bearer ' + t
  return h
}

async function request(method, path, body) {
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
  get:    (path)        => request('GET', path),
  post:   (path, body)  => request('POST', path, body),
  put:    (path, body)  => request('PUT', path, body),
  delete: (path)        => request('DELETE', path),

  /** Synchrone URL mit langlebigem JWT — nur für Inline-Ressourcen (img src, SSE).
   *  Für einmalige Downloads (PDF, Backup) stattdessen downloadUrl() nutzen. */
  url: (path) => BASE() + path + '?token=' + (getToken() || ''),

  /** Async URL mit kurzlebigem Einmal-Token (60s TTL) für Downloads (PDF, Backup).
   *  Verhindert, dass der langlebige JWT in Server-Logs landet. */
  downloadUrl: async (path) => {
    const res = await fetch(BASE() + '/api/auth/download-token', {
      method: 'POST',
      headers: headers(),
    })
    if (!res.ok) throw new Error('Download-Token konnte nicht ausgestellt werden')
    const { token } = await res.json()
    return BASE() + path + '?token=' + token
  },
}

export async function login(username, password) {
  const res = await fetch(BASE() + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error('Ungültige Anmeldedaten')
  const { token } = await res.json()
  setToken(token)
  return token
}

export function logout() { clearToken() }

export async function changePassword(currentPassword, newPassword) {
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

export function listUsers() { return api.get('/api/users') }
export function createUser(username, password, role) { return api.post('/api/users', { username, password, role }) }
export function deleteUser(username) { return api.delete(`/api/users/${username}`) }

export async function resetPassword(username) {
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

export function setServerUrl(url) {
  localStorage.setItem('server_url', url.replace(/\/$/, ''))
}

/**
 * Gemeinsame SSE-Verbindung pro Show.
 * Gibt { onChannels, onSections, onPresence, close } zurück.
 */
export function subscribeShow(showId, { onChannels, onSections, onPresence } = {}) {
  const url = BASE() + `/api/shows/${showId}/events?token=${getToken()}&device=web`
  const es = new EventSource(url)
  if (onChannels) es.addEventListener('channels-updated', (e) => onChannels(JSON.parse(e.data)))
  if (onSections) es.addEventListener('sections-updated', (e) => onSections(JSON.parse(e.data)))
  if (onPresence) es.addEventListener('presence-updated', (e) => onPresence(JSON.parse(e.data)))
  es.onerror = () => {} // reconnect automatically
  return () => es.close()
}

/** @deprecated Nutze subscribeShow() */
export function subscribeChannels(showId, onUpdate) {
  const url = BASE() + `/api/shows/${showId}/events`
  const es = new EventSource(url + '?token=' + getToken() + '&device=web')
  es.addEventListener('channels-updated', (e) => onUpdate(JSON.parse(e.data)))
  es.onerror = () => es.close()
  return () => es.close()
}

/** @deprecated Nutze subscribeShow() */
export function subscribeSections(showId, onUpdate) {
  const url = BASE() + `/api/shows/${showId}/events`
  const es = new EventSource(url + '?token=' + getToken() + '&device=web')
  es.addEventListener('sections-updated', (e) => onUpdate(JSON.parse(e.data)))
  es.onerror = () => es.close()
  return () => es.close()
}
