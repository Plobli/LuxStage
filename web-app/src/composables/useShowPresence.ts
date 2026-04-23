import { ref } from 'vue'
import { subscribeShow } from '../api/client'

export interface PresenceUser {
  username: string;
  device: string;
  [key: string]: any;
}

export interface PresenceCallbacks {
  onChannels?: (data: any) => void;
  onSections?: (data: any) => void;
}

export function useShowPresence(showId: string, callbacks: PresenceCallbacks) {
  const presence = ref<PresenceUser[]>([])
  let unsubscribeSSE: (() => void) | null = null

  function initPresence(): void {
    unsubscribeSSE = subscribeShow(showId, {
      onChannels: callbacks.onChannels,
      onSections: callbacks.onSections,
      onPresence: ({ users }: { users: PresenceUser[] }) => {
        presence.value = users
      },
    })
  }

  function cleanupPresence(): void {
    unsubscribeSSE?.()
  }

  return {
    presence,
    initPresence,
    cleanupPresence
  }
}

