/**
 * useTokenRefresh — erneuert das JWT automatisch im Hintergrund.
 *
 * Strategie: alle 5 Minuten prüfen ob das Token in weniger als 30 Minuten
 * abläuft. Falls ja, POST /api/auth/refresh und Token ersetzen.
 * Schlägt der Refresh fehl (401), wird der Nutzer ausgeloggt.
 */
import { onMounted, onUnmounted, getCurrentInstance } from 'vue'
import { useRouter } from 'vue-router'
import { getToken, setToken, clearToken } from '../api/client.js'
import { jwtDecode } from '../api/jwtDecode.js'

const CHECK_INTERVAL_MS = 5 * 60 * 1000   // alle 5 Minuten prüfen
const REFRESH_THRESHOLD_MS = 30 * 60 * 1000 // erneuern wenn < 30 Min. verbleiben

export function useTokenRefresh() {
  const instance = getCurrentInstance()
  if (!instance) return

  const router = useRouter()
  let intervalId = null

  async function tryRefresh() {
    const token = getToken()
    if (!token) return

    const payload = jwtDecode(token)
    if (!payload?.exp) return

    const msUntilExpiry = payload.exp * 1000 - Date.now()

    // Bereits abgelaufen → ausloggen
    if (msUntilExpiry <= 0) {
      clearToken()
      router.push('/login')
      return
    }

    // Noch genug Zeit → nichts tun
    if (msUntilExpiry > REFRESH_THRESHOLD_MS) return

    // Token erneuern
    try {
      const BASE = localStorage.getItem('server_url') || window.location.origin
      const res = await fetch(BASE + '/api/auth/refresh', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (res.status === 401) {
        clearToken()
        router.push('/login')
        return
      }
      if (res.ok) {
        const { token: newToken } = await res.json()
        setToken(newToken)
      }
    } catch {
      // Netzwerkfehler → still ignorieren, beim nächsten Tick erneut versuchen
    }
  }

  onMounted(() => {
    void tryRefresh()
    intervalId = setInterval(tryRefresh, CHECK_INTERVAL_MS)
  })

  onUnmounted(() => {
    clearInterval(intervalId)
  })
}
