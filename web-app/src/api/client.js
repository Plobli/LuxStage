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

  /** Datei-URL für direkten Browser-Zugriff (Fotos, PDF, Backup) */
  url: (path) => BASE() + path + '?token=' + (getToken() || ''),
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

/** SSE-Verbindung für Realtime Kanal-Updates */
export function subscribeChannels(showId, onUpdate) {
  const url = BASE() + `/api/shows/${showId}/events`
  const es = new EventSource(url + '?token=' + getToken())
  es.addEventListener('channels-updated', (e) => onUpdate(JSON.parse(e.data)))
  es.onerror = () => es.close()
  return () => es.close()
}

/** SSE-Verbindung für Realtime Sections-Updates */
export function subscribeSections(showId, onUpdate) {
  const url = BASE() + `/api/shows/${showId}/events`
  const es = new EventSource(url + '?token=' + getToken())
  es.addEventListener('sections-updated', (e) => onUpdate(JSON.parse(e.data)))
  es.onerror = () => es.close()
  return () => es.close()
}
