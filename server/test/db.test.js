import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { resetDb } from './helpers/db-reset.js'
import {
  createShow, readShow,
  readChannels, writeChannels,
  readPhotoOrder, writePhotoOrder, deletePhotoOrderEntry,
  createUser, listUsers, deleteUser, changePassword,
} from '../db.js'

beforeEach(() => resetDb())

describe('createShow', () => {
  it('ohne Template erstellt Show mit korrekten Feldern', () => {
    createShow('test-show', { name: 'Test Show', datum: '2026-01-01' })
    const show = readShow('test-show')
    assert.ok(show, 'Show sollte existieren')
    assert.equal(show.name, 'Test Show')
    assert.equal(show.datum, '2026-01-01')
    assert.equal(show.slug, 'test-show')
  })
})

describe('writeChannels / readChannels', () => {
  it('Round-trip: gespeicherte Channels kommen identisch zurück', () => {
    createShow('chan-show', { name: 'Channel Show' })
    const channels = [
      { channel: '1', name: 'Main', color: '#ff0000', notes: 'test', address: '', device: '', position: '' },
      { channel: '2', name: 'Fill', color: '#00ff00', notes: '', address: '', device: '', position: '' },
    ]
    writeChannels('chan-show', channels)
    const result = readChannels('chan-show')
    assert.equal(result.length, 2)
    assert.equal(result[0].channel, '1')
    assert.equal(result[0].color, '#ff0000')
    assert.equal(result[1].channel, '2')
    assert.equal(result[1].color, '#00ff00')
  })
})

describe('writePhotoOrder / readPhotoOrder', () => {
  it('Round-trip: Reihenfolge bleibt erhalten', () => {
    createShow('photo-show', { name: 'Photo Show' })
    const order = ['c.jpg', 'a.jpg', 'b.jpg']
    writePhotoOrder('photo-show', order)
    const result = readPhotoOrder('photo-show')
    assert.deepEqual(result, order)
  })
})

describe('deletePhotoOrderEntry', () => {
  it('Löscht nur den richtigen Eintrag', () => {
    createShow('del-show', { name: 'Del Show' })
    writePhotoOrder('del-show', ['a.jpg', 'b.jpg', 'c.jpg'])
    deletePhotoOrderEntry('del-show', 'b.jpg')
    const result = readPhotoOrder('del-show')
    assert.deepEqual(result, ['a.jpg', 'c.jpg'])
  })
})

describe('createUser / listUsers', () => {
  it('Nutzer erscheint in Liste mit korrekter Rolle', async () => {
    await createUser('testuser', 'passwort123', 'techniker')
    const users = listUsers()
    const found = users.find(u => u.username === 'testuser')
    assert.ok(found, 'Nutzer sollte in Liste sein')
    assert.equal(found.role, 'techniker')
  })
})

describe('deleteUser', () => {
  it('Nutzer verschwindet aus Liste', async () => {
    await createUser('toDelete', 'passwort123', 'techniker')
    deleteUser('toDelete')
    const users = listUsers()
    assert.ok(!users.find(u => u.username === 'toDelete'), 'Nutzer sollte gelöscht sein')
  })
})

describe('changePassword', () => {
  it('Gespeicherter Hash beginnt mit $2 (bcrypt)', async () => {
    await createUser('hashuser', 'altes-passwort', 'techniker')
    await changePassword('hashuser', 'neues-passwort')
    // Lies direkt aus DB um den Hash zu prüfen
    const { dbContainer } = await import('../db-init.js')
    const user = dbContainer.db.prepare('SELECT password FROM users WHERE username = ?').get('hashuser')
    assert.ok(user.password.startsWith('$2'), 'Hash sollte mit $2 beginnen (bcrypt)')
  })
})
