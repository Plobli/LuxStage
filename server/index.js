import http from 'node:http'
import fs from 'node:fs'
import { router } from './router.js'
import { config } from './config.js'
import { startHistoryJob } from './history.js'

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)))

const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean)
const isDev = process.env.NODE_ENV !== 'production'

const server = http.createServer((req, res) => {
  const origin = req.headers['origin'] || ''
  if (isDev || (corsOrigins.length > 0 && corsOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' blob: data:; script-src 'self'; style-src 'self' 'unsafe-inline'")

  router(req, res)
})

server.listen(config.port, '0.0.0.0', () => {
  console.log(`LuxStage Server v${pkg.version} läuft auf Port ${config.port}`)
  console.log(`Datenpfad: ${config.dataPath}`)
  startHistoryJob()
})
