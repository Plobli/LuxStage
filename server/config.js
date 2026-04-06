import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('FEHLER: JWT_SECRET fehlt oder zu kurz (min. 32 Zeichen). Server wird beendet.')
  process.exit(1)
}

const usersEnv = process.env.USERS
if (!usersEnv) {
  console.error('FEHLER: USERS fehlt. Bitte USERS als JSON-Array setzen, z.B.: \'[{"username":"admin","password":"...","role":"admin"}]\'')
  process.exit(1)
}

let users
try {
  users = JSON.parse(usersEnv)
  if (!Array.isArray(users) || users.length === 0) throw new Error('USERS muss ein nicht-leeres Array sein')
  for (const u of users) {
    if (!u.username || !u.password || !u.role) throw new Error(`Ungültiger Eintrag in USERS: ${JSON.stringify(u)}`)
  }
} catch (e) {
  console.error('FEHLER: USERS konnte nicht geparst werden:', e.message)
  process.exit(1)
}

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  dataPath: process.env.DATA_PATH || path.join(__dirname, '..', 'data'),
  jwtSecret,
  // Rollen: admin (alles), techniker (shows lesen/schreiben, keine templates/backup/update)
  users,
  lockTimeout: 10 * 60 * 1000, // 10 Minuten in ms
  photoMaxWidth: 1600,
  photoQuality: 82,
}
