import http from 'node:http'
import { router } from './router.js'
import { config } from './config.js'
import { startHistoryJob } from './history.js'

const corsOrigin = process.env.CORS_ORIGIN

const server = http.createServer((req, res) => {
  // CORS
  if (corsOrigin) res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; img-src 'self' blob: data:; script-src 'self'; style-src 'self' 'unsafe-inline'")

  router(req, res)
})

server.listen(config.port, () => {
  console.log(`LuxStage Server v1.1 läuft auf Port ${config.port}`)
  console.log(`Datenpfad: ${config.dataPath}`)
  startHistoryJob()
})
