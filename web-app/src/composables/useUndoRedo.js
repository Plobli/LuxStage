// web-app/src/composables/useUndoRedo.js
import { ref, computed, toRaw } from 'vue'

const MAX_HISTORY = 50

/**
 * @param {() => object} getState          – gibt aktuellen Zustand zurück
 * @param {(snapshot: object) => void} applyState – stellt Zustand wieder her
 * @param {() => void} cancelPendingSaves  – bricht laufende debounced Saves ab
 * @param {() => void} saveNow             – speichert sofort nach undo/redo
 * @param {string|null} storageKey         – sessionStorage-Schlüssel für Persistenz (optional)
 */
export function useUndoRedo(getState, applyState, cancelPendingSaves, saveNow = () => {}, storageKey = null) {
  const past = ref([])    // älteste zuerst
  const future = ref([])  // neueste zuerst (future[0] = nächster Redo-Schritt)

  let debounceTimer = null
  let pendingSnapshot = null   // Snapshot vor der ersten Änderung einer Debounce-Sequenz

  // ── sessionStorage ────────────────────────────────────────────────────────

  function _saveToStorage() {
    if (!storageKey) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ past: past.value, future: future.value }))
    } catch {
      // QuotaExceededError — still ohne Persistenz weiterarbeiten
    }
  }

  function _clearStorage() {
    if (!storageKey) return
    sessionStorage.removeItem(storageKey)
  }

  // ── Snapshots ─────────────────────────────────────────────────────────────

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

  /** Tiefer Clone des aktuellen Zustands (reaktive Proxies entfernt). */
  function _cloneState() {
    return structuredClone(_deepRaw(getState()))
  }

  function _push(snapshot) {
    future.value = []                          // Neue Änderung → Redo-Stack leeren
    past.value.push(snapshot)
    if (past.value.length > MAX_HISTORY) {
      past.value.shift()                       // Ältesten Eintrag verwerfen
    }
    _saveToStorage()
  }

  /** Initialer Snapshot beim Öffnen einer Show.
   *  Löscht vorhandene sessionStorage-History und setzt einen sauberen Ausgangspunkt. */
  function initSnapshot() {
    cancelDebounce()
    _clearStorage()
    past.value = [_cloneState()]
    future.value = []
    _saveToStorage()
  }

  /** Sofortiger Snapshot — für destruktive Aktionen. */
  function pushSnapshot() {
    cancelDebounce()
    _push(_cloneState())
  }

  /** Debounced Snapshot — für Texteingaben (500ms).
   *  Snapshot wird sofort beim ersten Aufruf aufgezeichnet (Zustand vor der Änderung),
   *  und erst nach 500ms ohne weitere Eingabe in den Stack gepusht. */
  function pushSnapshotDebounced() {
    if (!debounceTimer) {
      // Erster Aufruf dieser Sequenz: Zustand VOR der Änderung sichern
      pendingSnapshot = _cloneState()
    }
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      _push(pendingSnapshot)
      pendingSnapshot = null
    }, 500)
  }

  /** Debounce abbrechen — in onBeforeUnmount aufrufen */
  function cancelDebounce() {
    clearTimeout(debounceTimer)
    debounceTimer = null
    pendingSnapshot = null
  }

  function undo() {
    if (past.value.length <= 1) return   // mind. 1 Eintrag bleibt (der initiale Snapshot)
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

  const canUndo = computed(() => past.value.length > 1)  // > 1: initialer Snapshot zählt nicht
  const canRedo = computed(() => future.value.length > 0)

  return { initSnapshot, pushSnapshot, pushSnapshotDebounced, cancelDebounce, undo, redo, canUndo, canRedo }
}
