import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  dataPath: process.env.DATA_PATH || path.join(__dirname, '..', 'data'),
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  // Rollen: admin (alles), techniker (shows lesen/schreiben, keine templates/backup/update)
  users: JSON.parse(process.env.USERS || JSON.stringify([
    { username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin', role: 'admin' },
    { username: 'techniker', password: process.env.TECH_PASSWORD || 'techniker', role: 'techniker' }
  ])),
  lockTimeout: 10 * 60 * 1000, // 10 Minuten in ms
  photoMaxWidth: 1600,
  photoQuality: 82,
  versionCount: 5, // letzte N Versionen behalten
}
