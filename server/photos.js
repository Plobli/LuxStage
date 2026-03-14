/**
 * photos.js — Server-seitige Foto-Komprimierung mit sharp
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { config } from './config.js'
import { ensureDir, paths } from './io.js'

export async function savePhoto(showId, filename, buffer) {
  const dir = paths.showPhotos(showId)
  await ensureDir(dir)

  const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_')
  const outName = safeName.replace(/\.[^.]+$/, '.jpg')
  const outPath = path.join(dir, outName)

  await sharp(buffer)
    .resize({ width: config.photoMaxWidth, withoutEnlargement: true })
    .jpeg({ quality: config.photoQuality })
    .toFile(outPath)

  return outName
}

export async function listPhotos(showId) {
  const dir = paths.showPhotos(showId)
  try {
    const files = await fs.readdir(dir)
    return files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
  } catch { return [] }
}

export async function deletePhoto(showId, filename) {
  const dir = paths.showPhotos(showId)
  const safeName = path.basename(filename)
  await fs.unlink(path.join(dir, safeName))
}

/** Multipart-Body parsen (kein externer Parser nötig für einfache Uploads) */
export function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
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
    const headerStart = bStart + boundaryBuf.length + 2 // skip \r\n
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), headerStart)
    if (headerEnd === -1) break
    const header = body.slice(headerStart, headerEnd).toString()
    const dataStart = headerEnd + 4
    const bEnd = body.indexOf(boundaryBuf, dataStart)
    if (bEnd === -1) break
    const dataEnd = bEnd - 2 // remove trailing \r\n
    const nameMatch = header.match(/name="([^"]+)"/)
    const fileMatch = header.match(/filename="([^"]+)"/)
    if (nameMatch && fileMatch) {
      parts.push({
        fieldname: nameMatch[1],
        filename: fileMatch[1],
        data: body.slice(dataStart, dataEnd),
      })
    }
    start = bEnd
  }
  return parts
}
