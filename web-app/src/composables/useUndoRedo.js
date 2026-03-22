// web-app/src/composables/useUndoRedo.js
import { ref, computed } from 'vue'

const MAX_HISTORY = 50

/**
 * @param {() => object} getState   – gibt aktuellen Zustand zurück
 * @param {(snapshot: object) => void} applyState – stellt Zustand wieder her
 * @param {() => void} cancelPendingSaves – bricht laufende debounced Saves ab
 */
export function useUndoRedo(getState, applyState, cancelPendingSaves) {
  const past = ref([])    // älteste zuerst
  const future = ref([])  // neueste zuerst (future[0] = nächster Redo-Schritt)

  let debounceTimer = null

  /** Sofortiger Snapshot — für destruktive Aktionen */
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

  function _push(snapshot) {
    future.value = []                          // Neue Änderung → Redo-Stack leeren
    past.value.push(structuredClone(snapshot))
    if (past.value.length > MAX_HISTORY) {
      past.value.shift()                       // Ältesten Eintrag verwerfen
    }
  }

  function undo(saveNow) {
    if (!past.value.length) return
    const current = structuredClone(getState())
    future.value.unshift(current)
    const prev = past.value.pop()
    cancelPendingSaves()
    applyState(prev)
    saveNow()
  }

  function redo(saveNow) {
    if (!future.value.length) return
    const current = structuredClone(getState())
    past.value.push(current)
    const next = future.value.shift()
    cancelPendingSaves()
    applyState(next)
    saveNow()
  }

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  return { pushSnapshot, pushSnapshotDebounced, cancelDebounce, undo, redo, canUndo, canRedo }
}
