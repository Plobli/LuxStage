import http from 'node:http'
import { router } from '../../router.js'

export async function startTestServer() {
  const server = http.createServer(router)
  await new Promise(r => server.listen(0, r))
  const { port } = server.address()
  const stop = () => new Promise(r => server.close(r))
  return { port, stop }
}
