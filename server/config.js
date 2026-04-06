import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('FEHLER: JWT_SECRET fehlt oder zu kurz (min. 32 Zeichen). Server wird beendet.')
  process.exit(1)
}

const adminPassword = process.env.ADMIN_PASSWORD || 'admin'
const techPassword = process.env.TECH_PASSWORD || 'techniker'

if (!process.env.ADMIN_PASSWORD || adminPassword === 'admin') {
  console.warn('WARNUNG: Standard-Admin-Passwort aktiv! Bitte ADMIN_PASSWORD setzen.')
}
if (!process.env.TECH_PASSWORD || techPassword === 'techniker') {
  console.warn('WARNUNG: Standard-Techniker-Passwort aktiv! Bitte TECH_PASSWORD setzen.')
}

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  dataPath: process.env.DATA_PATH || path.join(__dirname, '..', 'data'),
  jwtSecret,
  // Rollen: admin (alles), techniker (shows lesen/schreiben, keine templates/backup/update)
  users: JSON.parse(process.env.USERS || JSON.stringify([
    { username: 'admin', password: adminPassword, role: 'admin' },
    { username: 'techniker', password: techPassword, role: 'techniker' }
  ])),
  lockTimeout: 10 * 60 * 1000, // 10 Minuten in ms
  photoMaxWidth: 1600,
  photoQuality: 82,
}
