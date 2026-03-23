// LuxStage/server/backup.js
import fs from 'node:fs/promises'
import archiver from 'archiver'
import path from 'node:path'
import { config } from './config.js'
import { db } from './db-init.js'

export async function streamBackup(res) {
  const backupPath = path.join(config.dataPath, 'luxstage-backup.db')

  try {
    await db.backup(backupPath)
  } catch (err) {
    console.error('Backup fehlgeschlagen:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Backup fehlgeschlagen' }))
    return
  }

  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="luxstage-backup-${timestamp()}.zip"`,
  })

  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.on('error', err => {
    console.error('Archive error:', err)
    res.destroy(err)
  })
  archive.pipe(res)
  archive.file(backupPath, { name: 'luxstage.db' })
  archive.directory(path.join(config.dataPath, 'photos'), 'photos')
  await archive.finalize()
  fs.unlink(backupPath).catch(() => {})
}

function timestamp() {
  return new Date().toISOString().slice(0, 10)
}
