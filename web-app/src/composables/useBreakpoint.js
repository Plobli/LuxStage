import { ref, onMounted, onUnmounted } from 'vue'

export function useIsMobile(breakpoint = 768) {
  const isMobile = ref(window.innerWidth < breakpoint)
  const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
  function update(e) { isMobile.value = e.matches }
  onMounted(() => mq.addEventListener('change', update))
  onUnmounted(() => mq.removeEventListener('change', update))
  return isMobile
}
