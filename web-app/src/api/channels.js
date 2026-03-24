import { api } from './client.js'

export async function fetchChannels(showId) {
  return api.get(`/api/shows/${showId}/channels`)
}

export async function saveChannels(showId, channels) {
  return api.put(`/api/shows/${showId}/channels`, channels)
}

export function downloadChannelsCsv(showId, channels) {
  const headers = ['channel', 'address', 'device', 'position', 'color', 'notes']
  const rows = [headers.join(';')]
  for (const ch of channels) rows.push(headers.map(h => ch[h] ?? '').join(';'))
  const csv = rows.join('\n') + '\n'
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${showId}-kanäle.csv`
  a.click()
  URL.revokeObjectURL(url)
}
