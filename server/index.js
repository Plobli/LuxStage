import http from 'node:http'
import { router } from './router.js'
import { config } from './config.js'
import { startHistoryJob } from './history.js'

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  router(req, res)
})

server.listen(config.port, () => {
  console.log(`LuxStage Server v1.1 läuft auf Port ${config.port}`)
  console.log(`Datenpfad: ${config.dataPath}`)
  startHistoryJob()
})
