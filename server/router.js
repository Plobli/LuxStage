import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseUrl, notFound, json } from './helpers.js'
import { authenticate } from './auth.js'
import { authRoutes } from './routes/auth.js'
import { userRoutes } from './routes/users.js'
import { showRoutes } from './routes/shows.js'
import { channelRoutes } from './routes/channels.js'
import { photoRoutes } from './routes/photos.js'
import { sectionRoutes } from './routes/sections.js'
import { templateRoutes } from './routes/templates.js'
import { floorplanRoutes } from './routes/floorplan.js'
import { historyRoutes } from './routes/history.js'
import { systemRoutes } from './routes/system.js'
import { smtpRoutes } from './routes/smtp.js'
import { updateRoutes } from './routes/update.js'
import { pdfRoutes } from './routes/pdf.js'

const distPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web-app', 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map':  'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
}

async function serveStaticFile(res, filePath, cacheControl) {
  const stat = await fs.promises.stat(filePath)
  if (stat.isDirectory()) throw new Error('EISDIR')
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': cacheControl,
  })
  fs.createReadStream(filePath).pipe(res)
}

async function serveStatic(req, res, pathname) {
  const safePathname = pathname === '/' ? '/index.html' : pathname
  const filePath = path.join(distPath, safePathname.replace(/^\//, ''))

  if (!filePath.startsWith(distPath + path.sep) && filePath !== distPath) return notFound(res)

  const isAsset = safePathname.startsWith('/assets/') || /\.[a-zA-Z0-9]+$/.test(safePathname)
  const cacheControl = safePathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'

  try {
    await serveStaticFile(res, filePath, cacheControl)
    return
  } catch {
    if (isAsset) return notFound(res)
  }

  try {
    await serveStaticFile(res, path.join(distPath, 'index.html'), 'no-cache')
  } catch {
    return notFound(res)
  }
}

const nil = (r) => r === null

export async function router(req, res) {
  let pathname, params
  try {
    ;({ pathname, params } = parseUrl(req.url))
  } catch {
    return notFound(res)
  }

  try {
    if (pathname.startsWith('/api/')) {
      // Öffentliche Endpunkte: nur Login braucht keine Auth
      if (pathname !== '/api/auth/login') {
        const user = authenticate(req)
        if (!user) return json(res, 401, { error: 'Nicht angemeldet' })
        req.user = user
      }

      // Reihenfolge: spezifische Prefixe zuerst
      if (pathname.startsWith('/api/auth/'))         { const r = await authRoutes(req, res, pathname);          if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/users'))          { const r = await userRoutes(req, res, pathname);          if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/smtp'))           { const r = await smtpRoutes(req, res, pathname);          if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/update'))         { const r = await updateRoutes(req, res, pathname, params); if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/floorplans/'))    { const r = await floorplanRoutes(req, res, pathname);     if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/templates'))      { const r = await templateRoutes(req, res, pathname);      if (nil(r)) notFound(res); return }
      if (pathname.startsWith('/api/shows/')) {
        // Sub-Ressourcen vor dem Show-Handler (spezifischer zuerst)
        if (/\/channels(\/|$)/.test(pathname))        { const r = await channelRoutes(req, res, pathname);           if (!nil(r)) return }
        if (/\/photos(\/|$)|\/photo-/.test(pathname)) { const r = await photoRoutes(req, res, pathname, params);     if (!nil(r)) return }
        if (/\/sections(\/|$)|\/section-defs/.test(pathname)) { const r = await sectionRoutes(req, res, pathname);  if (!nil(r)) return }
        if (/\/floorplan(\/|$)/.test(pathname))       { const r = await floorplanRoutes(req, res, pathname);        if (!nil(r)) return }
        if (/\/history(\/|$)/.test(pathname))         { const r = await historyRoutes(req, res, pathname);          if (!nil(r)) return }
        if (/\/pdf$/.test(pathname))                  { const r = await pdfRoutes(req, res, pathname);              if (nil(r)) notFound(res); return }
        { const r = await showRoutes(req, res, pathname, params); if (nil(r)) notFound(res); return }
      }
      if (pathname === '/api/shows' || pathname === '/api/shows/archived') {
        const r = await showRoutes(req, res, pathname, params); if (nil(r)) notFound(res); return
      }
      { const r = await systemRoutes(req, res, pathname); if (nil(r)) notFound(res); return }
    }

    if (req.method === 'GET') return serveStatic(req, res, pathname)

    return notFound(res)
  } catch (err) {
    console.error(err)
    if (!res.headersSent) json(res, 500, { error: 'Interner Fehler' })
  }
}
