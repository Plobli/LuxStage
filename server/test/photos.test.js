import { describe, it, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs/promises'
import { resetDb } from './helpers/db-reset.js'
import { createShow } from '../db.js'
import { savePhotoOrder, listPhotos, deletePhoto, getPhotoPath, extractFileFromMultipart } from '../photos.js'

beforeEach(() => resetDb())

// Aufräumen nach allen Tests
after(async () => {
  const { config } = await import('../config.js')
  const photosPath = path.join(config.dataPath, 'photos')
  await fs.rm(photosPath, { recursive: true, force: true })
})

describe('savePhotoOrder / listPhotos', () => {
  it('gespeicherte Reihenfolge wird korrekt zurückgegeben', async () => {
    createShow('order-show', { name: 'Order Show' })
    // Testdateien anlegen damit listPhotos sie findet
    const { config } = await import('../config.js')
    const dir = path.join(config.dataPath, 'photos', 'order-show')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'b.jpg'), 'x')
    await fs.writeFile(path.join(dir, 'a.jpg'), 'x')

    await savePhotoOrder('order-show', ['a.jpg', 'b.jpg'])
    const result = await listPhotos('order-show')
    assert.deepEqual(result, ['a.jpg', 'b.jpg'])
  })

  it('unbekannte Dateien in der Reihenfolge werden ignoriert', async () => {
    createShow('order-show2', { name: 'Order Show 2' })
    const { config } = await import('../config.js')
    const dir = path.join(config.dataPath, 'photos', 'order-show2')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'real.jpg'), 'x')

    await savePhotoOrder('order-show2', ['real.jpg', 'ghost.jpg'])
    const result = await listPhotos('order-show2')
    assert.deepEqual(result, ['real.jpg'])
  })
})

describe('getPhotoPath', () => {
  it('gibt korrekten absoluten Pfad zurück', async () => {
    const { config } = await import('../config.js')
    const result = getPhotoPath('test-show', 'foto.jpg')
    assert.ok(result.includes('test-show'), 'Pfad sollte Slug enthalten')
    assert.ok(result.endsWith('foto.jpg'), 'Pfad sollte Dateiname enthalten')
  })
})

describe('extractFileFromMultipart', () => {
  it('extrahiert Datei korrekt aus Multipart-Body', () => {
    const boundary = 'boundary123'
    const fileData = Buffer.from('fake-image-data')
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`
    const footer = `\r\n--${boundary}--`
    const body = Buffer.concat([Buffer.from(header), fileData, Buffer.from(footer)])

    const parts = extractFileFromMultipart(body, boundary)
    assert.equal(parts.length, 1)
    assert.equal(parts[0].filename, 'test.jpg')
    assert.equal(parts[0].fieldname, 'photo')
    assert.equal(parts[0].mimeType, 'image/jpeg')
    assert.deepEqual(parts[0].data, fileData)
  })

  it('gibt leeres Array zurück bei leerem Body', () => {
    const parts = extractFileFromMultipart(Buffer.from(''), 'boundary')
    assert.deepEqual(parts, [])
  })
})
