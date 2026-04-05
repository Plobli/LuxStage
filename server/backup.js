// LuxStage/server/backup.js
import fs from 'node:fs/promises'
import { createWriteStream, createReadStream } from 'node:fs'
import archiver from 'archiver'
import unzipper from 'unzipper'
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

export async function restoreBackup(req, res) {
  const restorePath = path.join(config.dataPath, 'luxstage-restore.zip')
  const photosPath = path.join(config.dataPath, 'photos')

  // Rohen Request-Body als ZIP-Datei speichern
  try {
    const writeStream = createWriteStream(restorePath)
    await new Promise((resolve, reject) => {
      req.pipe(writeStream)
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
      req.on('error', reject)
    })
  } catch (err) {
    console.error('Restore: Datei-Upload fehlgeschlagen:', err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Upload fehlgeschlagen' }))
    return
  }

  // ZIP entpacken und Inhalte prüfen
  let hasDb = false
  try {
    const zip = createReadStream(restorePath).pipe(unzipper.Parse({ forceStream: true }))
    for await (const entry of zip) {
      const fileName = entry.path
      if (fileName === 'luxstage.db') {
        hasDb = true
        const dbRestorePath = path.join(config.dataPath, 'luxstage-restore.db')
        await new Promise((resolve, reject) => {
          const out = createWriteStream(dbRestorePath)
          entry.pipe(out)
          out.on('finish', resolve)
          out.on('error', reject)
        })
      } else if (fileName.startsWith('photos/')) {
        const relPath = fileName.slice('photos/'.length)
        if (!relPath) { entry.autodrain(); continue }
        const destPath = path.join(photosPath, relPath)
        await fs.mkdir(path.dirname(destPath), { recursive: true })
        await new Promise((resolve, reject) => {
          const out = createWriteStream(destPath)
          entry.pipe(out)
          out.on('finish', resolve)
          out.on('error', reject)
        })
      } else {
        entry.autodrain()
      }
    }
  } catch (err) {
    console.error('Restore: ZIP-Verarbeitung fehlgeschlagen:', err)
    fs.unlink(restorePath).catch(() => {})
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Ungültiges ZIP-Archiv' }))
    return
  }

  fs.unlink(restorePath).catch(() => {})

  if (!hasDb) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'ZIP enthält keine luxstage.db' }))
    return
  }

  // Datenbank ersetzen: aktuelle DB schließen, Datei ersetzen, neu öffnen
  const dbRestorePath = path.join(config.dataPath, 'luxstage-restore.db')
  const dbPath = path.join(config.dataPath, 'luxstage.db')
  try {
    db.close()
    await fs.rename(dbRestorePath, dbPath)
    // Prozess neu starten damit die DB frisch eingelesen wird
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, restart: true }))
    setTimeout(() => process.exit(0), 500)
  } catch (err) {
    console.error('Restore: DB-Austausch fehlgeschlagen:', err)
    fs.unlink(dbRestorePath).catch(() => {})
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Datenbank konnte nicht ersetzt werden' }))
  }
}

function timestamp() {
  return new Date().toISOString().slice(0, 10)
}
