import { ref, nextTick } from 'vue'
import { uuid } from '../utils/uuid.js'

export function useFloorplanElements(elements, selectedIds, activeTool, snapToGrid, transformerRef, elementsLayerRef) {
  const clipboard = ref(null)
  const isElementDragging = ref(false)
  const draggingElementId = ref(null)

  const GRID_SIZE = 30
  function snap(val) {
    return snapToGrid.value ? Math.round(val / GRID_SIZE) * GRID_SIZE : val
  }

  function updateTransformer() {
    nextTick(() => {
      const tr = transformerRef.value?.getNode()
      const layer = elementsLayerRef.value?.getNode()
      if (!tr || !layer) return
      const transformable = [...selectedIds.value].map(id => {
        const el = elements.value.find(e => e.id === id)
        if (!el || el.type === 'channel') return null
        return layer.findOne(`#${id}`)
      }).filter(Boolean)
      tr.nodes(transformable)
      tr.getLayer()?.batchDraw()
    })
  }

  function addElement(el) {
    elements.value.push(el)
  }

  function deleteSelected(emitChange) {
    if (selectedIds.value.size === 0) return
    elements.value = elements.value.filter(e => !selectedIds.value.has(e.id))
    selectedIds.value = new Set()
    emitChange()
  }

  function copySelected() {
    if (selectedIds.value.size === 0) return
    clipboard.value = elements.value.filter(e => selectedIds.value.has(e.id)).map(e => ({ ...e }))
  }

  function pasteClipboard(emitChange) {
    if (!clipboard.value?.length) return
    const newIds = new Set()
    clipboard.value.forEach(el => {
      const newEl = { ...el, id: uuid(), x: (el.x ?? el.x1 ?? 0) + 20, y: (el.y ?? el.y1 ?? 0) + 20 }
      if (el.x1 !== undefined) { newEl.x1 = el.x1 + 20; newEl.y1 = el.y1 + 20; newEl.x2 = el.x2 + 20; newEl.y2 = el.y2 + 20 }
      elements.value.push(newEl)
      newIds.add(newEl.id)
    })
    selectedIds.value = newIds
    emitChange()
  }

  function duplicateSelected(emitChange) {
    copySelected()
    pasteClipboard(emitChange)
  }

  // Drag end handlers
  function onLineDragEnd(el, e, emitChange) {
    if (e) e.cancelBubble = true
    const node = e?.target
    if (!node) return
    const origCx = (el.x1 + el.x2) / 2
    const origCy = (el.y1 + el.y2) / 2
    const dx = node.x() - origCx
    const dy = node.y() - origCy
    el.x1 = snap(el.x1 + dx); el.y1 = snap(el.y1 + dy)
    el.x2 = snap(el.x2 + dx); el.y2 = snap(el.y2 + dy)
    const newCx = (el.x1 + el.x2) / 2
    const newCy = (el.y1 + el.y2) / 2
    node.position({ x: newCx, y: newCy })
    node.offsetX(newCx); node.offsetY(newCy)
    draggingElementId.value = null
    isElementDragging.value = false
    emitChange()
  }

  function onRectDragEnd(el, e, emitChange) {
    if (e) e.cancelBubble = true
    const node = e?.target
    if (!node) return
    el.x = snap(node.x() - el.w / 2)
    el.y = snap(node.y() - el.h / 2)
    node.position({ x: el.x + el.w / 2, y: el.y + el.h / 2 })
    draggingElementId.value = null
    isElementDragging.value = false
    emitChange()
  }

  function onSimpleDragEnd(el, e, emitChange) {
    if (e) e.cancelBubble = true
    const node = e?.target
    if (!node) return
    el.x = snap(node.x()); el.y = snap(node.y())
    draggingElementId.value = null
    isElementDragging.value = false
    emitChange()
  }

  // Transform end handlers
  function onLineTransformEnd(el, e, emitChange) {
    const node = e.target
    const sx = node.scaleX()
    const sy = node.scaleY()
    const rot = node.rotation() * Math.PI / 180
    const nx = node.x()
    const ny = node.y()
    const ox = (el.x1 + el.x2) / 2
    const oy = (el.y1 + el.y2) / 2
    const lx1 = el.x1 - ox; const ly1 = el.y1 - oy
    const lx2 = el.x2 - ox; const ly2 = el.y2 - oy
    function transformPt(lx, ly) {
      const scaled = { x: lx * sx, y: ly * sy }
      const rotated = {
        x: scaled.x * Math.cos(rot) - scaled.y * Math.sin(rot),
        y: scaled.x * Math.sin(rot) + scaled.y * Math.cos(rot),
      }
      return { x: rotated.x + nx, y: rotated.y + ny }
    }
    const p1 = transformPt(lx1, ly1)
    const p2 = transformPt(lx2, ly2)
    el.x1 = p1.x; el.y1 = p1.y
    el.x2 = p2.x; el.y2 = p2.y
    el.rotation = 0
    node.scaleX(1); node.scaleY(1)
    node.rotation(0)
    const newCx = (el.x1 + el.x2) / 2
    const newCy = (el.y1 + el.y2) / 2
    node.position({ x: newCx, y: newCy })
    node.offsetX(newCx); node.offsetY(newCy)
    node.points([el.x1, el.y1, el.x2, el.y2])
    emitChange()
  }

  function onRectTransformEnd(el, e, emitChange) {
    const node = e.target
    el.x = node.x() - node.width() * node.scaleX() / 2
    el.y = node.y() - node.height() * node.scaleY() / 2
    el.w = Math.max(5, node.width() * node.scaleX())
    el.h = Math.max(5, node.height() * node.scaleY())
    el.rotation = node.rotation()
    node.scaleX(1); node.scaleY(1)
    node.offsetX(el.w / 2); node.offsetY(el.h / 2)
    node.x(el.x + el.w / 2); node.y(el.y + el.h / 2)
    emitChange()
  }

  function onEllipseTransformEnd(el, e, emitChange) {
    const node = e.target
    el.x = node.x(); el.y = node.y()
    el.rx = Math.max(3, node.radiusX() * node.scaleX())
    el.ry = Math.max(3, node.radiusY() * node.scaleY())
    el.rotation = node.rotation()
    node.scaleX(1); node.scaleY(1)
    emitChange()
  }

  function onTextTransformEnd(el, e, emitChange) {
    const node = e.target
    el.x = node.x(); el.y = node.y()
    if (node.scaleX() !== 1) {
      el.fontSize = Math.max(6, Math.round((el.fontSize || 16) * node.scaleX()))
      node.scaleX(1); node.scaleY(1)
    }
    el.rotation = node.rotation()
    emitChange()
  }

  return {
    clipboard,
    isElementDragging,
    draggingElementId,
    updateTransformer,
    addElement,
    deleteSelected,
    copySelected,
    pasteClipboard,
    duplicateSelected,
    onLineDragEnd,
    onRectDragEnd,
    onSimpleDragEnd,
    onLineTransformEnd,
    onRectTransformEnd,
    onEllipseTransformEnd,
    onTextTransformEnd,
  }
}
