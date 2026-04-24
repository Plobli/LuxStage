import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || jwtSecret.length < 32) {
  console.error('FEHLER: JWT_SECRET fehlt oder zu kurz (min. 32 Zeichen). Server wird beendet.')
  process.exit(1)
}

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  dataPath: process.env.DATA_PATH || path.join(__dirname, '..', 'data'),
  jwtSecret,
  // Rollen: admin (alles), techniker (shows lesen/schreiben, keine templates/backup/update)
  lockTimeout: 10 * 60 * 1000, // 10 Minuten in ms
  photoMaxWidth: 1500,
  photoQuality: 70,
  photoThumbWidth: 400,
  photoThumbQuality: 60,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'LuxStage <noreply@luxstage.local>',
  },
}
