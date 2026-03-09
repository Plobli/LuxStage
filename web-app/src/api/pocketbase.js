import PocketBase from 'pocketbase'

const serverUrl = () => localStorage.getItem('server_url') || 'http://localhost:8090'

export const pb = new PocketBase(serverUrl())

// Re-point if user changes server in settings
export function setServerUrl(url) {
  localStorage.setItem('server_url', url)
  pb.baseUrl = url
}

export function isLoggedIn() {
  return pb.authStore.isValid
}

// Call once on app start: verifies the stored token is still valid on the server.
// Clears it (→ redirect to login) if the user was deleted or DB was reset.
export async function verifyAuth() {
  if (!pb.authStore.isValid) return
  try {
    await pb.collection('users').authRefresh()
  } catch {
    pb.authStore.clear()
  }
}

export function currentUser() {
  return pb.authStore.model
}

export async function login(email, password) {
  return await pb.collection('users').authWithPassword(email, password)
}

export function logout() {
  pb.authStore.clear()
}
