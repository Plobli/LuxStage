import { ref } from 'vue'

export function useDragReorder<T extends { id: string }>(
  items: { value: T[] },
  onReorder: (newOrder: T[]) => void
) {
  const draggedId = ref<string | null>(null)
  const dragOverId = ref<string | null>(null)

  function onDragStart(id: string) {
    draggedId.value = id
  }

  function onDragOver(e: DragEvent, id: string) {
    e.preventDefault()
    dragOverId.value = id
  }

  function onDrop(targetId: string) {
    const from = items.value.findIndex(i => i.id === draggedId.value)
    const to = items.value.findIndex(i => i.id === targetId)
    if (from === -1 || to === -1 || from === to) { reset(); return }
    const next = [...items.value]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    items.value = next
    onReorder(next)
    reset()
  }

  function onDragEnd() { reset() }

  function reset() {
    draggedId.value = null
    dragOverId.value = null
  }

  return { draggedId, dragOverId, onDragStart, onDragOver, onDrop, onDragEnd }
}
