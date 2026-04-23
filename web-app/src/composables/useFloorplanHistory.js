import { ref, nextTick } from 'vue'

export function useFloorplanHistory(elements, emit) {
  const history = ref([])
  const historyIndex = ref(-1)

  function exportData() {
    return JSON.stringify(elements.value)
  }

  function parseData(str) {
    if (!str) return
    try { elements.value = JSON.parse(str) } catch {}
  }

  function pushHistory() {
    const snap = exportData()
    let h = history.value.slice(0, historyIndex.value + 1)
    h.push(snap)
    if (h.length > 100) h = h.slice(-100)
    history.value = h
    historyIndex.value = history.value.length - 1
  }

  function captureSnapshot(stageRef, stageSize) {
    const stage = stageRef.value?.getNode()
    if (!stage) return null
    try {
      return stage.toDataURL({ pixelRatio: 1, x: 0, y: 0, width: stageSize.value.width, height: stageSize.value.height })
    } catch { return null }
  }

  function emitChange(stageRef, stageSize) {
    pushHistory()
    const canvasData = exportData()
    emit('change', canvasData, captureSnapshot(stageRef, stageSize))
  }

  function undo(stageRef, stageSize) {
    if (historyIndex.value <= 0) return
    historyIndex.value--
    parseData(history.value[historyIndex.value])
    const canvasData = history.value[historyIndex.value]
    nextTick(() => emit('change', canvasData, captureSnapshot(stageRef, stageSize)))
  }

  function redo(stageRef, stageSize) {
    if (historyIndex.value >= history.value.length - 1) return
    historyIndex.value++
    parseData(history.value[historyIndex.value])
    const canvasData = history.value[historyIndex.value]
    nextTick(() => emit('change', canvasData, captureSnapshot(stageRef, stageSize)))
  }

  function initHistory(initialData) {
    parseData(initialData)
    history.value = [exportData()]
    historyIndex.value = 0
  }

  return { history, historyIndex, exportData, parseData, pushHistory, captureSnapshot, emitChange, undo, redo, initHistory }
}
