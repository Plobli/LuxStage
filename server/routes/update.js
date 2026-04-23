import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { requireAdmin } from '../auth.js'
import { readJsonBody, json } from '../helpers.js'
import { config } from '../config.js'

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const nvmDir = process.env.NVM_DIR || path.join(process.env.HOME, '.nvm')
const nvmInit = `export NVM_DIR="${nvmDir}" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"`

function run(cmd, env = {}, maxBuffer = 1024 * 1024) {
  return new Promise((resolve, reject) =>
    execFile('/bin/bash', ['-c', `${nvmInit} && ${cmd}`],
      { maxBuffer, env: { ...process.env, ...env } },
      (err, stdout, stderr) => {
        if (err) { err.stderr = stderr; reject(err) } else { resolve(stdout.trim()) }
      }
    )
  )
}

export async function updateRoutes(req, res, pathname, params) {
  const { method } = req

  if (method === 'GET' && pathname === '/api/update/branches') {
    const user = requireAdmin(req, res); if (!user) return
    try {
      await run('git -C "$REPO_DIR" fetch --prune --quiet', { REPO_DIR: repoDir })
      const out = await run('git -C "$REPO_DIR" branch -r', { REPO_DIR: repoDir })
      const branches = out.split('\n')
        .map(b => b.trim().replace(/^origin\//, ''))
        .filter(b => b && !b.startsWith('HEAD'))
      return json(res, 200, { branches })
    } catch (err) {
      return json(res, 200, { branches: ['main'], error: err.message })
    }
  }

  if (method === 'GET' && pathname === '/api/update/check') {
    const user = requireAdmin(req, res); if (!user) return
    const branch = params.branch || 'main'
    if (!/^[a-zA-Z0-9_./-]+$/.test(branch)) return json(res, 400, { error: 'Ungültiger Branch-Name' })
    try {
      await run('git -C "$REPO_DIR" fetch --no-tags origin "$TARGET_BRANCH" --quiet', { REPO_DIR: repoDir, TARGET_BRANCH: branch })
      const behind = await run('git -C "$REPO_DIR" rev-list "HEAD..origin/$TARGET_BRANCH" --count', { REPO_DIR: repoDir, TARGET_BRANCH: branch })
      const commits = parseInt(behind, 10)
      if (commits === 0) return json(res, 200, { available: false, branch })
      const log = await run('git -C "$REPO_DIR" log HEAD..origin/"$TARGET_BRANCH" --oneline --no-decorate', { REPO_DIR: repoDir, TARGET_BRANCH: branch })
      return json(res, 200, { available: true, commits, log, branch })
    } catch (err) {
      return json(res, 200, { available: false, branch, error: err.message })
    }
  }

  if (method === 'POST' && pathname === '/api/update') {
    const user = requireAdmin(req, res); if (!user) return
    const fsp = await import('node:fs/promises')
    const distDir  = path.join(repoDir, 'web-app', 'dist')
    const distNew  = path.join(repoDir, 'web-app', 'dist-new')
    const distOld  = path.join(repoDir, 'web-app', 'dist-old')
    const dbPath   = path.join(config.dataPath, 'luxstage.db')
    const dbSnap   = path.join(config.dataPath, 'luxstage-preupdate.db')

    const bodyJson = await readJsonBody(req, res); if (bodyJson === null) return
    const branch = bodyJson.branch || 'main'
    if (!/^[a-zA-Z0-9_./-]+$/.test(branch)) return json(res, 400, { error: 'Ungültiger Branch-Name' })

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    const sendEvent = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

    let oldCommit = ''
    const log = []
    const step = (msg) => { log.push(msg); console.log('[update]', msg); sendEvent('log', { msg }) }

    const rollback = async (reason) => {
      step(`Rollback: ${reason}`)
      try { await run('git -C "$REPO_DIR" reset --hard "$OLD_COMMIT"', { REPO_DIR: repoDir, OLD_COMMIT: oldCommit }) } catch {}
      try { await fsp.rm(distNew, { recursive: true, force: true }) } catch {}
      try {
        const distOldExists = await fsp.access(distOld).then(() => true).catch(() => false)
        if (distOldExists) {
          await fsp.rm(distDir, { recursive: true, force: true }).catch(() => {})
          await fsp.rename(distOld, distDir)
        }
      } catch {}
      sendEvent('done', { error: reason, log })
      res.end()
    }

    const baseEnv = { REPO_DIR: repoDir, TARGET_BRANCH: branch }
    try {
      await run('git -C "$REPO_DIR" config pull.ff only', baseEnv).catch(() => {})
      await run('git -C "$REPO_DIR" config user.email "luxstage@localhost"', baseEnv).catch(() => {})
      await run('git -C "$REPO_DIR" config user.name "LuxStage"', baseEnv).catch(() => {})

      oldCommit = (await run('git -C "$REPO_DIR" rev-parse HEAD', baseEnv)).trim()
      step(`Aktueller Commit: ${oldCommit.slice(0, 8)}`)

      await run('cp "$DB_PATH" "$DB_SNAP"', { DB_PATH: dbPath, DB_SNAP: dbSnap })
      step('DB-Snapshot erstellt')

      await run('git -C "$REPO_DIR" fetch --no-tags origin "$TARGET_BRANCH"', baseEnv)
      await run('git -C "$REPO_DIR" reset --hard "origin/$TARGET_BRANCH"', baseEnv)
      step(`git reset --hard origin/${branch}`)
      step(`git pull (${branch}): Reset auf Remote-Stand`)

      const newCommit = (await run('git -C "$REPO_DIR" rev-parse HEAD', baseEnv)).trim()
      if (newCommit === oldCommit) step('Bereits aktuell')

      await run('npm install --prefix "$REPO_DIR/server"', baseEnv)
      step('Server-Abhängigkeiten installiert')

      await run('npm install --include=dev --prefix "$REPO_DIR/web-app"', baseEnv)
      step('Web-App-Abhängigkeiten installiert')

      await fsp.rm(distNew, { recursive: true, force: true }).catch(() => {})
      await run('cd "$REPO_DIR/web-app" && npm run build -- --outDir dist-new', { ...baseEnv, VITE_OUTDIR: 'dist-new' }, 10 * 1024 * 1024)
      step('Web-App gebaut')

      await fsp.access(path.join(distNew, 'index.html'))
      step('Build-Validierung OK')

      await fsp.rm(distOld, { recursive: true, force: true }).catch(() => {})
      const distExists = await fsp.access(distDir).then(() => true).catch(() => false)
      if (distExists) await fsp.rename(distDir, distOld)
      await fsp.rename(distNew, distDir)
      step('dist atomar ersetzt')

      fsp.rm(distOld, { recursive: true, force: true }).catch(() => {})
      fsp.unlink(dbSnap).catch(() => {})

      step('Neustart...')
      sendEvent('done', { log })
      res.end()
      setTimeout(() => process.exit(0), 500)
    } catch (err) {
      await rollback(err.message + (err.stderr ? '\n' + err.stderr : ''))
    }
    return
  }

  return null
}
