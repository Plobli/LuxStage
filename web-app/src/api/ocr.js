import { getToken } from './client.js'

const BASE = () => localStorage.getItem('server_url') || import.meta.env.VITE_SERVER_URL || window.location.origin

/**
 * Schickt ein oder mehrere Fotos an den Server und gibt den erkannten Showplan als JSON zurück.
 * @param {File|File[]} files — Ein oder mehrere Fotos aus einem <input type="file">
 * @returns {Promise<Object>} — Strukturiertes Showplan-JSON
 */
export async function ocrShowplan(files) {
  const fileList = Array.isArray(files) ? files : [files]
  const formData = new FormData()
  for (const file of fileList) {
    formData.append('file', file, file.name)
  }

  const res = await fetch(BASE() + '/api/ocr/showplan', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + getToken() },
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }

  return res.json()
}
