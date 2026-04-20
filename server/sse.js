/**
 * sse.js — Server-Sent Events für Realtime Kanal-Updates + Presence
 * Clients abonnieren /api/shows/:id/events
 */

// showId → Map<res, { username, device }>
const clients = new Map()

function initShow(showId) {
  if (!clients.has(showId)) clients.set(showId, new Map())
}

export function subscribe(showId, res, username, device, getChecksFn) {
  initShow(showId)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })
  res.write(':\n\n') // Verbindung bestätigen

  const map = clients.get(showId)
  map.set(res, { username, device })

  // Aktuellen Check-State sofort an den neuen Client senden
  if (getChecksFn) {
    const checks = getChecksFn(showId)
    const msg = `event: checks-updated\ndata: ${JSON.stringify({ checks })}\n\n`
    try { res.write(msg) } catch { /* ignore */ }
  }

  // Neue Presence sofort an alle senden
  broadcastPresence(showId)

  res.on('close', () => {
    map.delete(res)
    broadcastPresence(showId)
  })
}

export function broadcast(showId, event, data) {
  const map = clients.get(showId)
  if (!map?.size) return
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of map.keys()) {
    try { res.write(msg) } catch { map.delete(res) }
  }
}

function broadcastPresence(showId) {
  const map = clients.get(showId)
  if (!map) return
  // Aggregate: username → [devices]
  const byUser = new Map()
  for (const { username, device } of map.values()) {
    if (!byUser.has(username)) byUser.set(username, new Set())
    byUser.get(username).add(device)
  }
  const users = Array.from(byUser.entries()).map(([username, devices]) => ({
    username,
    devices: Array.from(devices),
  }))
  broadcast(showId, 'presence-updated', { users })
}

export function getPresence(showId) {
  const map = clients.get(showId)
  if (!map?.size) return []
  const byUser = new Map()
  for (const { username, device } of map.values()) {
    if (!byUser.has(username)) byUser.set(username, new Set())
    byUser.get(username).add(device)
  }
  return Array.from(byUser.entries()).map(([username, devices]) => ({
    username,
    devices: Array.from(devices),
  }))
}

// Heartbeat: tote Sockets entfernen, Verbindungsabbrüche durch Reverse-Proxies verhindern
setInterval(() => {
  for (const map of clients.values()) {
    for (const res of map.keys()) {
      res.write(':\n\n', (err) => {
        if (err) { map.delete(res); res.end() }
      })
    }
  }
}, 15_000)
