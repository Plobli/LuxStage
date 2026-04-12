// LuxStage/server/photos.js
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { config } from './config.js'
import * as db from './db.js'

function photosDir(slug) {
  const base = path.join(config.dataPath, 'photos')
  const resolved = path.resolve(base, slug)
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error('Invalid slug')
  }
  return resolved
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true })
}

export async function savePhoto(slug, filename, buffer) {
  const dir = photosDir(slug)
  await ensureDir(dir)

  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_')
  const outName = safeName.replace(/\.[^.]+$/, '.jpg')
  const outPath = path.join(dir, outName)

  await sharp(buffer)
    .rotate()
    .resize({ width: config.photoMaxWidth, withoutEnlargement: true })
    .jpeg({ quality: config.photoQuality })
    .toFile(outPath)

  return outName
}

export async function listPhotos(slug) {
  const dir = photosDir(slug)

  // Migration: vorhandene photo-order.json einmalig in DB übertragen
  const jsonPath = path.join(dir, 'photo-order.json')
  try {
    const raw = await fs.readFile(jsonPath, 'utf8')
    const jsonOrder = JSON.parse(raw)
    if (Array.isArray(jsonOrder) && jsonOrder.length > 0) {
      db.writePhotoOrder(slug, jsonOrder)
    }
    await fs.unlink(jsonPath).catch(() => {})
  } catch { /* Datei existiert nicht oder ungültig — ignorieren */ }

  // Alle vorhandenen Dateien im Verzeichnis
  let files
  try {
    files = (await fs.readdir(dir)).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
  } catch { return [] }

  // Reihenfolge aus DB
  const ordered = db.readPhotoOrder(slug).filter(f => files.includes(f))
  const rest = files.filter(f => !ordered.includes(f)).sort()
  return [...ordered, ...rest]
}

export async function savePhotoOrder(slug, order) {
  const safenames = order.map(f => path.basename(f).replace(/[^a-zA-Z0-9._-]/g, '_'))
  db.writePhotoOrder(slug, safenames)
}

export async function deletePhoto(slug, filename) {
  const dir = photosDir(slug)
  const safeName = path.basename(filename)
  await fs.unlink(path.join(dir, safeName))
  db.deletePhotoOrderEntry(slug, safeName)
}

export function getPhotoPath(slug, filename) {
  return path.join(photosDir(slug), path.basename(filename))
}

const MAX_PHOTO_UPLOAD_BYTES = 50 * 1024 * 1024 // 50 MB

export function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0
    req.on('data', c => {
      size += c.length
      if (size > MAX_PHOTO_UPLOAD_BYTES) { req.destroy(); return reject(new Error('Upload zu groß')) }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export function extractFileFromMultipart(body, boundary) {
  const boundaryBuf = Buffer.from('--' + boundary)
  const parts = []
  let start = 0

  while (start < body.length) {
    const bStart = body.indexOf(boundaryBuf, start)
    if (bStart === -1) break
    const headerStart = bStart + boundaryBuf.length + 2
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), headerStart)
    if (headerEnd === -1) break
    const header = body.slice(headerStart, headerEnd).toString()
    const dataStart = headerEnd + 4
    const bEnd = body.indexOf(boundaryBuf, dataStart)
    if (bEnd === -1) break
    const dataEnd = bEnd - 2
    const nameMatch = header.match(/name="([^"]+)"/)
    const fileMatch = header.match(/filename="([^"]+)"/)
    if (nameMatch && fileMatch) {
      const ctMatch = header.match(/content-type:\s*(\S+)/i)
      parts.push({ fieldname: nameMatch[1], filename: fileMatch[1], data: body.slice(dataStart, dataEnd), mimeType: ctMatch?.[1] || null })
    }
    start = bEnd
  }
  return parts
}
