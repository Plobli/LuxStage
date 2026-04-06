/**
 * backup.js — ZIP-Backup-Download und -Restore
 */
import { api, getToken } from './client.js'

export async function downloadBackup() {
  const url = await api.downloadUrl('/api/backup')
  window.location.href = url
}

export async function uploadRestore(file) {
  const BASE = localStorage.getItem('server_url') || window.location.origin
  const res = await fetch(BASE + '/api/restore', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + (getToken() || ''),
      'Content-Type': 'application/zip',
    },
    body: file,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `HTTP ${res.status}`)
  }
  return res.json()
}
