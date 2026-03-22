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

  // ── sessionStorage ────────────────────────────────────────────────────────

  function _saveToStorage() {
    if (!storageKey) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ past: past.value, future: future.value }))
    } catch {
      // QuotaExceededError — still ohne Persistenz weiterarbeiten
    }
  }

  function _loadFromStorage() {
    if (!storageKey) return
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (!raw) return
      const { past: p, future: f } = JSON.parse(raw)
      if (Array.isArray(p)) past.value = p
      if (Array.isArray(f)) future.value = f
    } catch {
      // Korrupte Daten — ignorieren
    }
  }

  _loadFromStorage()

  // ── Snapshots ─────────────────────────────────────────────────────────────

  /** Sofortiger Snapshot — für destruktive Aktionen.
   *  Verwirft ausstehenden Debounce (kein Flush — aktueller Stand wird via getState() gesichert). */
  function pushSnapshot() {
    cancelDebounce()
    _push(getState())
  }

  /** Debounced Snapshot — für Texteingaben (500ms) */
  function pushSnapshotDebounced() {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      _push(getState())
    }, 500)
  }

  /** Debounce abbrechen — in onBeforeUnmount aufrufen */
  function cancelDebounce() {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

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

  function _push(snapshot) {
    future.value = []                          // Neue Änderung → Redo-Stack leeren
    past.value.push(structuredClone(_deepRaw(snapshot)))
    if (past.value.length > MAX_HISTORY) {
      past.value.shift()                       // Ältesten Eintrag verwerfen
    }
    _saveToStorage()
  }

  function undo() {
    if (!past.value.length) return
    const current = structuredClone(_deepRaw(getState()))
    future.value.unshift(current)
    const prev = past.value.pop()
    cancelPendingSaves()
    applyState(prev)
    saveNow()
    _saveToStorage()
  }

  function redo() {
    if (!future.value.length) return
    const current = structuredClone(_deepRaw(getState()))
    past.value.push(current)
    const next = future.value.shift()
    cancelPendingSaves()
    applyState(next)
    saveNow()
    _saveToStorage()
  }

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  return { pushSnapshot, pushSnapshotDebounced, cancelDebounce, undo, redo, canUndo, canRedo }
}
