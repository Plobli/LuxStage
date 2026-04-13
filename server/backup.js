// LuxStage/server/backup.js
import fs from 'node:fs/promises'
import { createWriteStream, createReadStream } from 'node:fs'
import archiver from 'archiver'
import unzipper from 'unzipper'
import path from 'node:path'
import Database from 'better-sqlite3'
import { config } from './config.js'
import { dbContainer } from './db-init.js'

export async function streamBackup(res) {
  const backupPath = path.join(config.dataPath, 'luxstage-backup.db')

  try {
    await dbContainer.db.backup(backupPath)
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
  const dbRestorePath = path.join(config.dataPath, 'luxstage-restore.db')
  const dbPath = path.join(config.dataPath, 'luxstage.db')
  const photosPath = path.join(config.dataPath, 'photos')

  const MAX_BACKUP_BYTES = 500 * 1024 * 1024 // 500 MB

  // Step 1: Receive and write ZIP to disk
  try {
    const writeStream = createWriteStream(restorePath)
    await new Promise((resolve, reject) => {
      let received = 0
      req.on('data', chunk => {
        received += chunk.length
        if (received > MAX_BACKUP_BYTES) { req.destroy(); writeStream.destroy(); reject(new Error('Upload zu groß')) }
      })
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

  // Step 2: Extract DB file only from ZIP into luxstage-restore.db
  let hasDb = false
  try {
    const zip = createReadStream(restorePath).pipe(unzipper.Parse({ forceStream: true }))
    for await (const entry of zip) {
      const fileName = entry.path
      if (fileName === 'luxstage.db') {
        hasDb = true
        await new Promise((resolve, reject) => {
          const out = createWriteStream(dbRestorePath)
          entry.pipe(out)
          out.on('finish', resolve)
          out.on('error', reject)
        })
      } else {
        // Skip everything else during this pass
        entry.autodrain()
      }
    }
  } catch (err) {
    console.error('Restore: ZIP-Verarbeitung fehlgeschlagen:', err)
    await fs.unlink(restorePath).catch(() => {})
    await fs.unlink(dbRestorePath).catch(() => {})
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Ungültiges ZIP-Archiv' }))
    return
  }

  if (!hasDb) {
    await fs.unlink(restorePath).catch(() => {})
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'ZIP enthält keine luxstage.db' }))
    return
  }

  // Step 3: Run PRAGMA integrity_check on temporary connection
  let integrityCheckOk = false
  let tempDb = null
  try {
    tempDb = new Database(dbRestorePath, { readonly: true })
    const integrityResult = tempDb.prepare('PRAGMA integrity_check').all()
    // If result is single row with 'ok', integrity is good. Otherwise, it failed.
    integrityCheckOk = integrityResult.length === 1 && integrityResult[0]['integrity_check'] === 'ok'
    tempDb.close()
  } catch (err) {
    console.error('Restore: DB-Integritätsprüfung fehlgeschlagen:', err)
    if (tempDb) tempDb.close()
    await fs.unlink(restorePath).catch(() => {})
    await fs.unlink(dbRestorePath).catch(() => {})
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Datenbank-Integritätsprüfung fehlgeschlagen' }))
    return
  }

  if (!integrityCheckOk) {
    console.error('Restore: Integritätsprüfung fehlgeschlagen — DB ist beschädigt')
    await fs.unlink(restorePath).catch(() => {})
    await fs.unlink(dbRestorePath).catch(() => {})
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Datenbank ist beschädigt oder ungültig' }))
    return
  }

  // Step 4: Extract photos from ZIP (now that DB is valid)
  try {
    const zip = createReadStream(restorePath).pipe(unzipper.Parse({ forceStream: true }))
    for await (const entry of zip) {
      const fileName = entry.path
      if (fileName.startsWith('photos/')) {
        const relPath = fileName.slice('photos/'.length).replace(/\\/g, '/')
        if (!relPath || relPath.endsWith('/') || entry.type === 'Directory') { entry.autodrain(); continue }
        if (relPath.includes('..') || path.isAbsolute(relPath)) { entry.autodrain(); continue }
        if (relPath.length > 255) { entry.autodrain(); continue }
        if (!/\.(jpg|jpeg|png|gif|webp)$/i.test(relPath)) { entry.autodrain(); continue }
        const destPath = path.resolve(photosPath, relPath)
        if (!destPath.startsWith(photosPath + path.sep)) { entry.autodrain(); continue }
        await fs.mkdir(path.dirname(destPath), { recursive: true })
        await new Promise((resolve, reject) => {
          const out = createWriteStream(destPath)
          entry.pipe(out)
          out.on('finish', resolve)
          out.on('error', (err) => { out.destroy(); reject(err) })
          entry.on('error', (err) => { out.destroy(); reject(err) })
        })
      } else {
        entry.autodrain()
      }
    }
  } catch (err) {
    console.error('Restore: Foto-Extraktion fehlgeschlagen:', err)
    await fs.unlink(restorePath).catch(() => {})
    await fs.unlink(dbRestorePath).catch(() => {})
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Foto-Extraktion fehlgeschlagen' }))
    return
  }

  await fs.unlink(restorePath).catch(() => {})

  // Step 5: Atomic DB swap
  try {
    dbContainer.db.close()
    await fs.rename(dbRestorePath, dbPath)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, restart: true }))
    // Step 6: Exit process
    setTimeout(() => process.exit(0), 500)
  } catch (err) {
    console.error('Restore: DB-Austausch fehlgeschlagen:', err)
    await fs.unlink(dbRestorePath).catch(() => {})
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Datenbank konnte nicht ersetzt werden' }))
  }
}

function timestamp() {
  return new Date().toISOString().slice(0, 10)
}
