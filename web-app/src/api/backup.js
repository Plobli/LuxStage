import { pb } from './pocketbase.js'

export async function exportShowBackup(showId) {
  const [show, channels] = await Promise.all([
    pb.collection('shows').getOne(showId),
    pb.collection('channels').getFullList({ filter: `show = "${showId}"`, sort: 'position,channel_number' }),
  ])
  const data = { version: 1, exported: new Date().toISOString(), show, channels }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = (show.name || 'show').replace(/[^a-z0-9]/gi, '_') + '_backup.json'
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportAllBackup() {
  const [shows, channels] = await Promise.all([
    pb.collection('shows').getFullList({ sort: '-date' }),
    pb.collection('channels').getFullList({ sort: 'show,position,channel_number' }),
  ])
  const data = { version: 1, exported: new Date().toISOString(), shows, channels }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'luxstage_backup_' + new Date().toISOString().slice(0, 10) + '.json'
  a.click()
  URL.revokeObjectURL(url)
}

export function parseBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try { resolve(JSON.parse(e.target.result)) }
      catch { reject(new Error('Ungültige JSON-Datei')) }
    }
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'))
    reader.readAsText(file)
  })
}

export async function importBackup(data) {
  if (data.version !== 1) throw new Error('Unbekanntes Backup-Format')
  const shows = data.shows ?? (data.show ? [data.show] : [])
  const channelsByShow = {}
  for (const ch of (data.channels ?? [])) {
    const key = ch.show
    if (!channelsByShow[key]) channelsByShow[key] = []
    channelsByShow[key].push(ch)
  }
  const results = []
  for (const show of shows) {
    const { id: oldId, collectionId, collectionName, created, updated, ...showData } = show
    const newShow = await pb.collection('shows').create({ ...showData, archived: false })
    const chs = channelsByShow[oldId] ?? []
    for (const ch of chs) {
      const { id, collectionId, collectionName, created, updated, show: _s, ...chData } = ch
      await pb.collection('channels').create({ ...chData, show: newShow.id })
    }
    results.push({ show: newShow, channelCount: chs.length })
  }
  return results
}
