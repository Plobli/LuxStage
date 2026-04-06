// web-app/src/composables/useUndoRedo.js
import { ref, computed, toRaw } from 'vue'

const MAX_HISTORY = 50

/**
 * Undo/Redo wie in Word: jede abgeschlossene Aktion (blur, destruktive Aktion)
 * wird als Schritt gesichert. Undo/Redo setzt den gesamten App-Zustand zurück.
 *
 * @param {() => object} getState          – gibt aktuellen Zustand zurück
 * @param {(snapshot: object) => void} applyState – stellt Zustand wieder her
 * @param {() => void} cancelPendingSaves  – bricht laufende debounced Saves ab
 * @param {() => void} saveNow             – speichert sofort nach undo/redo
 * @param {string|null} storageKey         – sessionStorage-Schlüssel für Persistenz (optional)
 */
export function useUndoRedo(getState, applyState, cancelPendingSaves, saveNow = () => {}, storageKey = null) {
  const past = ref([])    // älteste zuerst; past[last] = aktueller Stand
  const future = ref([])  // neueste zuerst (future[0] = nächster Redo-Schritt)

  // ── sessionStorage ────────────────────────────────────────────────────────

  function _saveToStorage() {
    if (!storageKey) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ past: past.value, future: future.value }))
    } catch { /* QuotaExceededError — ignorieren */ }
  }

  function _clearStorage() {
    if (!storageKey) return
    sessionStorage.removeItem(storageKey)
  }

  // ── Hilfsfunktionen ───────────────────────────────────────────────────────

  function _deepRaw(val) {
    if (Array.isArray(val)) return val.map(item => _deepRaw(toRaw(item)))
    if (val && typeof val === 'object') {
      const raw = toRaw(val)
      const result = {}
      for (const key of Object.keys(raw)) result[key] = _deepRaw(raw[key])
      return result
    }
    return val
  }

  function _cloneState() {
    return structuredClone(_deepRaw(getState()))
  }

  function _push(snapshot) {
    future.value = []
    past.value.push(snapshot)
    if (past.value.length > MAX_HISTORY) past.value.shift()
    _saveToStorage()
  }

  // ── Öffentliche API ───────────────────────────────────────────────────────

  /** Beim Öffnen einer Show: löscht alte History, setzt sauberen Ausgangspunkt. */
  function initSnapshot() {
    _clearStorage()
    try {
      past.value = [_cloneState()]
    } catch (e) {
      console.error('[useUndoRedo] initSnapshot fehlgeschlagen:', e)
      past.value = []
    }
    future.value = []
    _saveToStorage()
  }

  /** Snapshot des aktuellen Zustands sichern — für destruktive Aktionen
   *  (Kanal löschen, Drag&Drop, CSV-Import etc.) VOR der Änderung aufrufen. */
  function pushSnapshot() {
    try { _push(_cloneState()) }
    catch (e) { console.error('[useUndoRedo] pushSnapshot fehlgeschlagen:', e) }
  }

  /** Snapshot nach einer Texteingabe sichern — bei @blur aufrufen.
   *  Speichert den aktuellen Zustand nur wenn er sich vom letzten Snapshot unterscheidet. */
  function pushSnapshotIfChanged() {
    try {
      const current = _cloneState()
      const last = past.value[past.value.length - 1]
      if (last && JSON.stringify(current) === JSON.stringify(last)) return
      _push(current)
    } catch (e) {
      console.error('[useUndoRedo] pushSnapshotIfChanged fehlgeschlagen:', e)
    }
  }

  function undo() {
    if (past.value.length <= 1) return
    const current = _cloneState()
    future.value.unshift(current)
    const prev = past.value.pop()
    cancelPendingSaves()
    applyState(prev)
    saveNow()
    _saveToStorage()
  }

  function redo() {
    if (!future.value.length) return
    const current = _cloneState()
    past.value.push(current)
    const next = future.value.shift()
    cancelPendingSaves()
    applyState(next)
    saveNow()
    _saveToStorage()
  }

  const canUndo = computed(() => past.value.length > 1)
  const canRedo = computed(() => future.value.length > 0)

  return { initSnapshot, pushSnapshot, pushSnapshotIfChanged, undo, redo, canUndo, canRedo }
}
