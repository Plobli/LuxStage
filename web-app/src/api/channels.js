/**
 * channels.js — Kanal-API v1.1
 * Kanäle werden als CSV-String gelesen/geschrieben (eine Datei pro Show).
 * Parse/Serialize passiert hier im Client.
 */
import { api } from './client.js'

const HEADERS = ['channel', 'device', 'color', 'address', 'category', 'position', 'notes']

// ── CSV ←→ Array ──────────────────────────────────────────────────────────

export function parseCsv(csv) {
  const lines = csv.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(';').map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = line.split(';')
    return Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? '').trim()]))
  })
}

export function serializeCsv(channels) {
  const rows = [HEADERS.join(';')]
  for (const ch of channels) {
    rows.push(HEADERS.map(h => ch[h] ?? '').join(';'))
  }
  return rows.join('\n') + '\n'
}

// ── API ───────────────────────────────────────────────────────────────────

export async function fetchChannels(showId) {
  const { csv } = await api.get(`/api/shows/${showId}/channels`)
  return parseCsv(csv)
}

export async function saveChannels(showId, channels) {
  const csv = serializeCsv(channels)
  return api.put(`/api/shows/${showId}/channels`, { csv })
}
