import { ref } from 'vue'
import { subscribeShow } from '../api/client.js'

export function useShowPresence(showId, callbacks) {
  const presence = ref([])
  let unsubscribeSSE = null

  function initPresence() {
    unsubscribeSSE = subscribeShow(showId, {
      onChannels: callbacks.onChannels,
      onSections: callbacks.onSections,
      onPresence: ({ users }) => {
        presence.value = users
      },
    })
  }

  function cleanupPresence() {
    unsubscribeSSE?.()
  }

  return {
    presence,
    initPresence,
    cleanupPresence
  }
}
