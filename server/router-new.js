import { createRouter } from './route-matcher.js'
import { authRoutes } from './routes/auth.js'
import { json, notFound } from './helpers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

function isStaticAssetRequest(pathname) {
  return /\.[a-zA-Z0-9]+$/.test(pathname)
}

function mimeFromFilename(filename) {
  const ext = path.extname(filename || '').toLowerCase()
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  }[ext] || 'application/octet-stream'
}

async function serveStaticFile(res, filePath, cacheControl) {
  const stat = await fs.promises.stat(filePath)
  if (stat.isDirectory()) throw new Error('EISDIR')
  res.writeHead(200, {
    'Content-Type': mimeFromFilename(filePath),
    'Content-Length': stat.size,
    'Cache-Control': cacheControl,
  })
  fs.createReadStream(filePath).pipe(res)
}

const router = createRouter([
  [{ method: 'GET', path: '/api/health', handler: healthHandler }],
  authRoutes,
])

async function healthHandler(req, res) {
  return json(res, 200, { ok: true })
}

export async function handler(req, res) {
  const { method } = req
  let pathname
  try {
    pathname = new URL(req.url, 'http://localhost').pathname
  } catch {
    return notFound(res)
  }

  try {
    const matched = router.match(method, pathname)
    if (matched) {
      const { route, params } = matched
      req.params = params

      let index = 0
      const next = async () => {
        if (index >= (route.middleware || []).length) {
          return await route.handler(req, res)
        }
        const fn = route.middleware[index++]
        await fn(req, res, next)
      }

      await next()
      return
    }

    // Static files and SPA fallback
    if (method === 'GET') {
      const distPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web-app', 'dist')
      const safePathname = pathname === '/' ? '/index.html' : pathname
      const filePath = path.join(distPath, safePathname.replace(/^\//, ''))

      if (!filePath.startsWith(distPath + path.sep) && filePath !== distPath) return notFound(res)

      const isAsset = safePathname.startsWith('/assets/') || isStaticAssetRequest(safePathname)
      const cacheControl = safePathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache'

      try {
        await serveStaticFile(res, filePath, cacheControl)
        return
      } catch {
        if (isAsset) return notFound(res)
      }

      try {
        await serveStaticFile(res, path.join(distPath, 'index.html'), 'no-cache')
        return
      } catch {
        return notFound(res)
      }
    }

    return notFound(res)
  } catch (err) {
    console.error(err)
    json(res, 500, { error: 'Interner Fehler' })
  }
}
