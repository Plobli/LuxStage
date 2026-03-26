import { api } from './client.js'

export async function fetchChannels(showId) {
  return api.get(`/api/shows/${showId}/channels`)
}

export async function saveChannels(showId, channels) {
  return api.put(`/api/shows/${showId}/channels`, channels)
}

export function parseChannelsCsv(text) {
  const lines = text.split('\n').filter(Boolean)
  if (lines.length <= 1) return []
  const headers = ['channel', 'address', 'device', 'position', 'color', 'notes']
  return lines.slice(1).map(line => {
    const parts = line.split(';')
    return Object.fromEntries(headers.map((h, i) => [h, (parts[i] ?? '').trim()]))
  }).filter(ch => ch.channel !== '')
}

export function mergeChannels(existing, imported) {
  const result = existing.map(ch => {
    const match = imported.find(i => i.channel === ch.channel)
    if (!match) return ch
    return { ...ch, ...Object.fromEntries(Object.entries(match).filter(([, v]) => v !== '')) }
  })
  for (const imp of imported) {
    if (!result.find(ch => ch.channel === imp.channel)) {
      result.push(imp)
    }
  }
  result.sort((a, b) => parseInt(a.channel) - parseInt(b.channel))
  return result
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
