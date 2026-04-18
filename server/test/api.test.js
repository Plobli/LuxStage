import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { resetDb } from './helpers/db-reset.js'
import { hashPassword, signToken, issueDownloadToken, authenticate } from '../auth.js'
import { parseUrl, json } from '../helpers.js'

beforeEach(() => resetDb())

describe('parseUrl', () => {
  it('zerlegt einfache URL korrekt', () => {
    const result = parseUrl('/api/shows/meine-show')
    assert.equal(result.pathname, '/api/shows/meine-show')
  })

  it('extrahiert Query-Parameter', () => {
    const result = parseUrl('/api/shows?token=abc&device=web')
    assert.equal(result.params.token, 'abc')
    assert.equal(result.params.device, 'web')
  })
})

describe('hashPassword / authenticate via signToken', () => {
  it('signToken erzeugt gültiges JWT', () => {
    const token = signToken('admin', 'admin')
    assert.ok(typeof token === 'string', 'Token muss ein String sein')
    assert.ok(token.split('.').length === 3, 'Token muss 3 JWT-Teile haben')
  })

  it('authenticate gibt null zurück bei fehlendem Token', () => {
    const req = { headers: {} }
    const result = authenticate(req)
    assert.equal(result, null)
  })

  it('authenticate gibt Payload zurück bei gültigem Bearer-Token', () => {
    const token = signToken('testuser', 'viewer')
    const req = { headers: { authorization: 'Bearer ' + token } }
    const result = authenticate(req)
    assert.ok(result, 'Payload muss zurückgegeben werden')
    assert.equal(result.username, 'testuser')
    assert.equal(result.role, 'viewer')
  })

  it('authenticate gibt null zurück bei ungültigem Token', () => {
    const req = { headers: { authorization: 'Bearer ungueltig.token.hier' } }
    const result = authenticate(req)
    assert.equal(result, null)
  })
})

describe('issueDownloadToken', () => {
  it('erzeugt einen non-leeren Token-String', () => {
    const token = issueDownloadToken('admin', 'admin')
    assert.ok(typeof token === 'string')
    assert.ok(token.length > 0)
  })

  it('erzeugt unterschiedliche Token pro Aufruf', () => {
    const t1 = issueDownloadToken('admin', 'admin')
    const t2 = issueDownloadToken('admin', 'admin')
    assert.notEqual(t1, t2)
  })
})

describe('hashPassword', () => {
  it('erzeugt einen bcrypt-Hash', async () => {
    const hash = await hashPassword('geheimesPasswort')
    assert.ok(typeof hash === 'string')
    assert.ok(hash.startsWith('$2b$'), 'Muss bcrypt-Format sein')
  })

  it('zwei Hashes desselben Passworts sind unterschiedlich (Salt)', async () => {
    const h1 = await hashPassword('passwort')
    const h2 = await hashPassword('passwort')
    assert.notEqual(h1, h2)
  })
})
