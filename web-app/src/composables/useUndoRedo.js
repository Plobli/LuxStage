// web-app/src/composables/useUndoRedo.js
import { ref, computed, toRaw } from 'vue'

const MAX_HISTORY = 50

/**
 * Undo/Redo wie in Word.
 *
 * Invariante: past[i] ist der Zustand VOR der i-ten Änderung.
 * Undo stellt past[last] wieder her (= Zustand vor letzter Änderung).
 *
 * Für Texteingaben:
 *   1. @focus  → recordFocus()   speichert Zustand vor der Eingabe
 *   2. @blur   → commitFocus()   pusht den gespeicherten Snapshot falls sich etwas geändert hat
 *
 * Für destruktive Aktionen (löschen, drag&drop, import):
 *   → pushSnapshot() direkt VOR der Änderung aufrufen
 *
 * @param {() => object} getState
 * @param {(snapshot: object) => void} applyState
 * @param {() => void} cancelPendingSaves
 * @param {() => void} saveNow
 * @param {string|null} storageKey
 */
export function useUndoRedo(getState, applyState, cancelPendingSaves, saveNow = () => {}, storageKey = null) {
  const past = ref([])    // älteste zuerst; past[0] = initialer Stand
  const future = ref([])

  let focusSnapshot = null  // Zustand beim letzten @focus

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

  /** Beim Öffnen einer Show: sauberer Ausgangspunkt. */
  function initSnapshot() {
    _clearStorage()
    focusSnapshot = null
    try {
      past.value = [_cloneState()]
    } catch (e) {
      console.error('[useUndoRedo] initSnapshot fehlgeschlagen:', e)
      past.value = []
    }
    future.value = []
    _saveToStorage()
  }

  /** @focus auf einem Textfeld — merkt sich den Zustand VOR der Eingabe. */
  function recordFocus() {
    try {
      focusSnapshot = _cloneState()
    } catch (e) {
      console.error('[useUndoRedo] recordFocus fehlgeschlagen:', e)
      focusSnapshot = null
    }
  }

  /** @blur auf einem Textfeld — pusht focusSnapshot falls sich etwas geändert hat. */
  function commitFocus() {
    if (!focusSnapshot) return
    try {
      const current = _cloneState()
      if (JSON.stringify(current) !== JSON.stringify(focusSnapshot)) {
        _push(focusSnapshot)
      }
    } catch (e) {
      console.error('[useUndoRedo] commitFocus fehlgeschlagen:', e)
    }
    focusSnapshot = null
  }

  /** VOR einer destruktiven Aktion aufrufen (löschen, drag&drop, import etc.). */
  function pushSnapshot() {
    focusSnapshot = null
    try { _push(_cloneState()) }
    catch (e) { console.error('[useUndoRedo] pushSnapshot fehlgeschlagen:', e) }
  }

  function undo() {
    focusSnapshot = null
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
    focusSnapshot = null
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

  return { initSnapshot, recordFocus, commitFocus, pushSnapshot, undo, redo, canUndo, canRedo }
}
