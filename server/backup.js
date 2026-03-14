/**
 * backup.js — ZIP-Download aller Shows + Templates
 */
import archiver from 'archiver'
import { config } from './config.js'

export function streamBackup(res) {
  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="luxstage-backup-${timestamp()}.zip"`,
  })

  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.pipe(res)
  archive.directory(config.dataPath, 'LuxStage-Daten')
  archive.finalize()
}

function timestamp() {
  return new Date().toISOString().slice(0, 10)
}
