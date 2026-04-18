import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { resetDb } from './helpers/db-reset.js'

// backup.js ist schwer unit-testbar (streamt direkt in HTTP-Response und liest
// globalen dbContainer). Diese Datei stellt sicher dass das Modul importierbar
// ist und die exportierten Funktionen vorhanden sind.

beforeEach(() => resetDb())

describe('backup module', () => {
  it('exportiert streamBackup und restoreBackup', async () => {
    const mod = await import('../backup.js')
    assert.equal(typeof mod.streamBackup, 'function', 'streamBackup muss eine Funktion sein')
    assert.equal(typeof mod.restoreBackup, 'function', 'restoreBackup muss eine Funktion sein')
  })
})
