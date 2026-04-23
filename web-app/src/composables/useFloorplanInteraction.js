import { ref } from 'vue'
import { uuid } from '../utils/uuid.js'

export function useFloorplanInteraction({
  elements,
  selectedIds,
  activeTool,
  snapToGrid,
  panOffset,
  stageRef,
  stageScale,
  showGrid,
  addElement,
  deleteSelected,
  copySelected,
  pasteClipboard,
  duplicateSelected,
  emitChange,
  undo,
  redo,
  stageSize,
}) {
  const preview = ref(null)
  const drawStart = ref(null)
  const lassoRect = ref(null)
  const pendingDirectionId = ref(null)
  const isPanning = ref(false)
  const panStart = ref(null)
  const spaceHeld = ref(false)
  const showChannelPicker = ref(false)
  const channelPickerPos = ref({ x: 0, y: 0 })

  const GRID_SIZE = 30
  function snap(val) {
    return snapToGrid.value ? Math.round(val / GRID_SIZE) * GRID_SIZE : val
  }

  function getPointerPos() {
    const stage = stageRef.value?.getNode()
    if (!stage) return { x: 0, y: 0 }
    const pos = stage.getPointerPosition()
    if (!pos) return { x: 0, y: 0 }
    return {
      x: pos.x - panOffset.value.x,
      y: pos.y - panOffset.value.y,
    }
  }

  function onNodeClick(id, e) {
    if (activeTool.value !== 'select') return
    e.cancelBubble = true
    if (e.evt.shiftKey) {
      const s = new Set(selectedIds.value)
      s.has(id) ? s.delete(id) : s.add(id)
      selectedIds.value = s
    } else {
      selectedIds.value = new Set([id])
    }
  }

  function onStageMouseDown(e) {
    const stage = stageRef.value?.getNode()
    if (!stage) return
    const clickedOnStage = e.target === stage || e.target.getType() === 'Layer'
    const pos = getPointerPos()

    if (activeTool.value === 'pan' || spaceHeld.value) {
      isPanning.value = true
      panStart.value = { mx: e.evt.clientX, my: e.evt.clientY, ox: panOffset.value.x, oy: panOffset.value.y }
      return
    }

    if (activeTool.value === 'select') {
      if (clickedOnStage && !e.evt.shiftKey) selectedIds.value = new Set()
      if (clickedOnStage) drawStart.value = pos
      lassoRect.value = null
      return
    }

    if (!clickedOnStage) return

    if (activeTool.value === 'line' || activeTool.value === 'rect' || activeTool.value === 'ellipse') {
      drawStart.value = pos
      preview.value = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, x: pos.x, y: pos.y, w: 0, h: 0, cx: pos.x, cy: pos.y, rx: 0, ry: 0 }
    } else if (activeTool.value === 'channel' || activeTool.value === 'text') {
      drawStart.value = pos
    }
  }

  function onStageMouseMove(_e) {
    if (activeTool.value === 'channel-direction' && pendingDirectionId.value) {
      const el = elements.value.find(e => e.id === pendingDirectionId.value)
      if (el) {
        const pos = getPointerPos()
        el.rotation = Math.atan2(pos.y - el.y, pos.x - el.x) * 180 / Math.PI
      }
      return
    }

    if (isPanning.value) return
    if (!drawStart.value) return
    const pos = getPointerPos()

    if (activeTool.value === 'select') {
      lassoRect.value = {
        x: Math.min(pos.x, drawStart.value.x),
        y: Math.min(pos.y, drawStart.value.y),
        w: Math.abs(pos.x - drawStart.value.x),
        h: Math.abs(pos.y - drawStart.value.y),
      }
      return
    }
    if (activeTool.value === 'line') {
      preview.value = { ...preview.value, x2: pos.x, y2: pos.y }
    } else if (activeTool.value === 'rect') {
      preview.value = {
        x: Math.min(drawStart.value.x, pos.x),
        y: Math.min(drawStart.value.y, pos.y),
        w: Math.abs(pos.x - drawStart.value.x),
        h: Math.abs(pos.y - drawStart.value.y),
      }
    } else if (activeTool.value === 'ellipse') {
      preview.value = {
        cx: (drawStart.value.x + pos.x) / 2,
        cy: (drawStart.value.y + pos.y) / 2,
        rx: Math.abs(pos.x - drawStart.value.x) / 2,
        ry: Math.abs(pos.y - drawStart.value.y) / 2,
      }
    }
  }

  function onStageMouseUp(_e) {
    if (activeTool.value === 'channel-direction' && pendingDirectionId.value) {
      const el = elements.value.find(e => e.id === pendingDirectionId.value)
      if (el) {
        const pos = getPointerPos()
        const dx = pos.x - el.x
        const dy = pos.y - el.y
        el.rotation = Math.atan2(dy, dx) * 180 / Math.PI
        emitChange()
      }
      pendingDirectionId.value = null
      activeTool.value = 'select'
      return
    }

    if (isPanning.value) {
      isPanning.value = false
      panStart.value = null
      return
    }

    if (!drawStart.value) return
    const pos = getPointerPos()
    const dx = pos.x - drawStart.value.x
    const dy = pos.y - drawStart.value.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (activeTool.value === 'select' && lassoRect.value) {
      const { x, y, w, h } = lassoRect.value
      const inLasso = elements.value.filter(el => {
        let cx, cy
        if (el.type === 'line') { cx = (el.x1 + el.x2) / 2; cy = (el.y1 + el.y2) / 2 }
        else if (el.type === 'rect') { cx = el.x + el.w / 2; cy = el.y + el.h / 2 }
        else { cx = el.x; cy = el.y }
        return cx >= x && cx <= x + w && cy >= y && cy <= y + h
      })
      selectedIds.value = new Set(inLasso.map(e => e.id))
      lassoRect.value = null
      drawStart.value = null
      return
    }

    if (dist > 5) {
      if (activeTool.value === 'line') {
        addElement({ id: uuid(), type: 'line', x1: snap(drawStart.value.x), y1: snap(drawStart.value.y), x2: snap(pos.x), y2: snap(pos.y), rotation: 0, color: '#6b7280', strokeWidth: 2 })
        emitChange()
      } else if (activeTool.value === 'rect') {
        addElement({
          id: uuid(), type: 'rect',
          x: snap(Math.min(drawStart.value.x, pos.x)),
          y: snap(Math.min(drawStart.value.y, pos.y)),
          w: snap(Math.abs(pos.x - drawStart.value.x)),
          h: snap(Math.abs(pos.y - drawStart.value.y)),
          rotation: 0, color: '#6b7280', strokeWidth: 2, fill: 'transparent'
        })
        emitChange()
      } else if (activeTool.value === 'ellipse') {
        addElement({
          id: uuid(), type: 'ellipse',
          x: snap((drawStart.value.x + pos.x) / 2),
          y: snap((drawStart.value.y + pos.y) / 2),
          rx: snap(Math.abs(pos.x - drawStart.value.x) / 2),
          ry: snap(Math.abs(pos.y - drawStart.value.y) / 2),
          rotation: 0, color: '#6b7280', strokeWidth: 2, fill: 'transparent'
        })
        emitChange()
      }
      activeTool.value = 'select'
    } else {
      if (activeTool.value === 'channel') {
        channelPickerPos.value = { x: snap(drawStart.value.x), y: snap(drawStart.value.y) }
        showChannelPicker.value = true
      } else if (activeTool.value === 'text') {
        addElement({ id: uuid(), type: 'text', x: snap(drawStart.value.x), y: snap(drawStart.value.y), text: 'Text', rotation: 0, color: '#9ca3af', fontSize: 16, fontStyle: 'normal' })
        emitChange()
        activeTool.value = 'select'
      } else if (activeTool.value === 'select') {
        selectedIds.value = new Set()
      }
    }

    drawStart.value = null
    preview.value = null
    lassoRect.value = null
  }

  function onWindowMouseMove(e) {
    if (!isPanning.value || !panStart.value) return
    const s = stageScale.value
    const dx = (e.clientX - panStart.value.mx) / s
    const dy = (e.clientY - panStart.value.my) / s
    panOffset.value = { x: panStart.value.ox + dx, y: panStart.value.oy + dy }
  }

  function onWindowMouseUp() {
    if (isPanning.value) {
      isPanning.value = false
      panStart.value = null
    }
  }

  function isInputFocused() {
    const tag = document.activeElement?.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA'
  }

  function handleKeyDown(e) {
    if (isInputFocused()) return

    if (e.key === ' ') { e.preventDefault(); spaceHeld.value = true; return }

    if (!e.ctrlKey && !e.metaKey) {
      if (e.key === 'v' || e.key === 'V') { activeTool.value = 'select'; return }
      if (e.key === 'h' || e.key === 'H') { activeTool.value = 'pan'; return }
      if (e.key === 'l' || e.key === 'L') { activeTool.value = 'line'; return }
      if (e.key === 'r' || e.key === 'R') { activeTool.value = 'rect'; return }
      if (e.key === 'e' || e.key === 'E') { activeTool.value = 'ellipse'; return }
      if (e.key === 't' || e.key === 'T') { activeTool.value = 'text'; return }
      if (e.key === 'c' && activeTool.value !== 'select') { activeTool.value = 'channel'; return }
      if (e.key === 'g' || e.key === 'G') { showGrid.value = !showGrid.value; return }
      if (e.key === 'f' || e.key === 'F') { resetView(); return }
      if (e.key === 'Escape') {
        if (activeTool.value === 'channel-direction') pendingDirectionId.value = null
        activeTool.value = 'select'
        selectedIds.value = new Set()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(emitChange); return }

      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key) && selectedIds.value.size > 0) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        elements.value.forEach(el => {
          if (!selectedIds.value.has(el.id)) return
          if (el.type === 'line') { el.x1 += dx; el.y1 += dy; el.x2 += dx; el.y2 += dy }
          else { el.x = (el.x || 0) + dx; el.y = (el.y || 0) + dy }
        })
        emitChange()
        return
      }
    }

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return }
      if (e.key === 'c') { e.preventDefault(); copySelected(); return }
      if (e.key === 'v') { e.preventDefault(); pasteClipboard(emitChange); return }
      if (e.key === 'd') { e.preventDefault(); duplicateSelected(emitChange); return }
      if (e.key === 'a') { e.preventDefault(); selectedIds.value = new Set(elements.value.map(e => e.id)); return }
      if (e.key === '0') { e.preventDefault(); resetView(); return }
    }
  }

  function handleKeyUp(e) {
    if (e.key === ' ') spaceHeld.value = false
  }

  function resetView() {
    panOffset.value = { x: 0, y: 0 }
  }

  function placeChannelCircle(ch, emitChangeFn) {
    const id = uuid()
    addElement({ id, type: 'channel', x: channelPickerPos.value.x, y: channelPickerPos.value.y, channel: ch.channel, rotation: 0 })
    showChannelPicker.value = false
    pendingDirectionId.value = id
    activeTool.value = 'channel-direction'
    emitChangeFn()
  }

  return {
    preview,
    drawStart,
    lassoRect,
    pendingDirectionId,
    isPanning,
    panStart,
    spaceHeld,
    showChannelPicker,
    channelPickerPos,
    onNodeClick,
    onStageMouseDown,
    onStageMouseMove,
    onStageMouseUp,
    onWindowMouseMove,
    onWindowMouseUp,
    handleKeyDown,
    handleKeyUp,
    resetView,
    placeChannelCircle,
  }
}
