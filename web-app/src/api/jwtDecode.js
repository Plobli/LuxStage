/** Minimaler JWT-Payload-Decoder (kein Package nötig) */
export function jwtDecode(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return null }
}
