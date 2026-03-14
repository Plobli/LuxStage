/**
 * sse.js — Server-Sent Events für Realtime Kanal-Updates
 * Clients abonnieren /api/shows/:id/events
 */

const clients = new Map() // showId → Set<res>

export function subscribe(showId, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })
  res.write(':\n\n') // Verbindung bestätigen
  if (!clients.has(showId)) clients.set(showId, new Set())
  clients.get(showId).add(res)
  res.on('close', () => {
    clients.get(showId)?.delete(res)
  })
}

export function broadcast(showId, event, data) {
  const subs = clients.get(showId)
  if (!subs?.size) return
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of subs) {
    try { res.write(msg) } catch { subs.delete(res) }
  }
}
