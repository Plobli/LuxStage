import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { resetDb } from './helpers/db-reset.js'
import { createShow, writeChannels, readChannels, readShowSections, writeShowSections } from '../db.js'
import { takeSnapshotNow, listHistory, restoreHistoryEntry } from '../history.js'

beforeEach(() => resetDb())

describe('takeSnapshotNow', () => {
  it('Eintrag erscheint in history-Tabelle', () => {
    createShow('snap-show', { name: 'Snap Show' })
    const result = takeSnapshotNow('snap-show')
    assert.equal(result, true, 'takeSnapshotNow sollte true zurückgeben')
    const history = listHistory('snap-show')
    assert.equal(history.length, 1, 'Sollte einen History-Eintrag haben')
  })

  it('Ungültige Show gibt false zurück', () => {
    const result = takeSnapshotNow('nonexistent-show')
    assert.equal(result, false, 'Sollte false zurückgeben für nicht existente Show')
  })
})

describe('Doppelter Snapshot', () => {
  it('Identische Daten → kein zweiter Eintrag (Hash-Deduplikation)', () => {
    createShow('dedup-show', { name: 'Dedup Show' })
    const result1 = takeSnapshotNow('dedup-show')
    assert.equal(result1, true)
    const result2 = takeSnapshotNow('dedup-show')
    assert.equal(result2, true)
    const history = listHistory('dedup-show')
    assert.equal(history.length, 1, 'Sollte nur einen Eintrag haben (Deduplikation)')
  })

  it('Unterschiedliche Daten → zweiter Eintrag wird erstellt', () => {
    createShow('diff-show', { name: 'Diff Show' })
    takeSnapshotNow('diff-show')
    // Channels ändern
    const channels = [{ channel: '1', color: '#ff0000', notes: '', address: '', device: '', position: '' }]
    writeChannels('diff-show', channels)
    takeSnapshotNow('diff-show')
    const history = listHistory('diff-show')
    assert.equal(history.length, 2, 'Sollte zwei Einträge haben (unterschiedliche Daten)')
  })
})

describe('restoreHistoryEntry', () => {
  it('Channels werden korrekt wiederhergestellt', () => {
    createShow('restore-show', { name: 'Restore Show' })
    const channels = [{ channel: '1', color: '#ff0000', notes: 'Test', address: '', device: '', position: '' }]
    writeChannels('restore-show', channels)
    takeSnapshotNow('restore-show')
    // Channels überschreiben
    writeChannels('restore-show', [])
    assert.equal(readChannels('restore-show').length, 0, 'Channels sollten leer sein')
    // Restore
    const history = listHistory('restore-show')
    assert.ok(history.length > 0, 'Sollte History-Einträge haben')
    const restored = restoreHistoryEntry('restore-show', history[0].id)
    assert.equal(restored, true, 'restoreHistoryEntry sollte true zurückgeben')
    const result = readChannels('restore-show')
    assert.equal(result.length, 1, 'Sollte einen Channel wiederhergestellt haben')
    assert.equal(result[0].channel, '1', 'Channel sollte korrekt sein')
    assert.equal(result[0].color, '#ff0000', 'Channel Farbe sollte korrekt sein')
  })

  it('Channels + Sections werden korrekt wiederhergestellt', () => {
    createShow('restore-sections-show', { name: 'Restore Sections Show' })
    // Zunächst Channels speichern
    const channels = [{ channel: '1', color: '#00ff00', notes: '', address: '', device: '', position: '' }]
    writeChannels('restore-sections-show', channels)
    takeSnapshotNow('restore-sections-show')
    // Channels leeren
    writeChannels('restore-sections-show', [])
    assert.equal(readChannels('restore-sections-show').length, 0, 'Channels sollten leer sein')
    // Restore
    const history = listHistory('restore-sections-show')
    const restored = restoreHistoryEntry('restore-sections-show', history[0].id)
    assert.equal(restored, true)
    const result = readChannels('restore-sections-show')
    assert.equal(result.length, 1, 'Sollte einen Channel wiederhergestellt haben')
    assert.equal(result[0].color, '#00ff00', 'Farbe sollte korrekt sein')
  })

  it('Ungültige Show gibt false zurück', () => {
    const result = restoreHistoryEntry('nonexistent', 'some-id')
    assert.equal(result, false, 'Sollte false zurückgeben für nicht existente Show')
  })

  it('Ungültiger History-ID gibt false zurück', () => {
    createShow('invalid-id-show', { name: 'Invalid ID Show' })
    takeSnapshotNow('invalid-id-show')
    const result = restoreHistoryEntry('invalid-id-show', 'invalid-history-id')
    assert.equal(result, false, 'Sollte false zurückgeben für ungültige History-ID')
  })
})

describe('MAX_HISTORY Limit', () => {
  it('Bei >50 Snapshots werden älteste gelöscht', () => {
    createShow('limit-show', { name: 'Limit Show' })
    // 52 Snapshots mit verschiedenen Daten erzeugen
    for (let i = 0; i < 52; i++) {
      writeChannels('limit-show', [{ channel: String(i + 1), color: '#000000', notes: '', address: '', device: '', position: '' }])
      takeSnapshotNow('limit-show')
    }
    const history = listHistory('limit-show')
    assert.ok(history.length <= 50, `Sollte max 50 Einträge haben, hat ${history.length}`)
  })
})

describe('listHistory Rückgabe-Format', () => {
  it('Gibt Array mit id und created_at Feldern zurück', () => {
    createShow('format-show', { name: 'Format Show' })
    takeSnapshotNow('format-show')
    const history = listHistory('format-show')
    assert.equal(history.length, 1)
    assert.ok(history[0].id, 'Sollte ein id Feld haben')
    assert.ok(typeof history[0].created_at === 'number', 'created_at sollte eine Zahl sein')
  })

  it('Nicht existente Show gibt leeres Array zurück', () => {
    const history = listHistory('nonexistent-show')
    assert.deepEqual(history, [], 'Sollte leeres Array zurückgeben')
  })
})
