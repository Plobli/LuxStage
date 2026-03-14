/**
 * photos.js — Foto-API v1.1
 * Komprimierung passiert server-seitig (sharp) — kein Canvas mehr nötig.
 */
import { api, getToken } from './client.js'

const BASE = () => localStorage.getItem('server_url') || 'http://localhost:3000'

export async function fetchPhotos(showId) {
  return api.get(`/api/shows/${showId}/photos`)
}

export async function uploadPhoto(showId, file) {
  const formData = new FormData()
  formData.append('photo', file, file.name)
  const res = await fetch(`${BASE()}/api/shows/${showId}/photos`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + getToken() },
    body: formData,
  })
  if (!res.ok) throw new Error(`Upload fehlgeschlagen: ${res.status}`)
  return res.json()
}

export async function deletePhoto(showId, filename) {
  return api.delete(`/api/shows/${showId}/photos/${filename}`)
}

export function getPhotoUrl(showId, filename) {
  return `${BASE()}/api/shows/${showId}/photos/${filename}?token=${getToken()}`
}
