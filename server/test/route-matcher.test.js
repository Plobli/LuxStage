import assert from 'node:assert'
import { test } from 'node:test'
import { createRouter } from '../route-matcher.js'

test('RouteMatcher - exact path matching', () => {
  const router = createRouter([
    { method: 'GET', path: '/api/health', handler: () => {} },
    { method: 'POST', path: '/api/auth/login', handler: () => {} },
  ])

  const match1 = router.match('GET', '/api/health')
  assert.ok(match1, 'Should match /api/health')
  assert.equal(match1.route.path, '/api/health')

  const match2 = router.match('POST', '/api/auth/login')
  assert.ok(match2, 'Should match POST /api/auth/login')

  const noMatch = router.match('GET', '/api/auth/login')
  assert.equal(noMatch, null, 'Should not match wrong method')
})

test('RouteMatcher - path parameter extraction', () => {
  const router = createRouter([
    { method: 'GET', path: '/api/shows/:slug', handler: () => {} },
    { method: 'PUT', path: '/api/shows/:slug/meta', handler: () => {} },
  ])

  const match1 = router.match('GET', '/api/shows/my-show')
  assert.ok(match1, 'Should match parameterized path')
  assert.deepEqual(match1.params, { slug: 'my-show' })

  const match2 = router.match('PUT', '/api/shows/another-show/meta')
  assert.ok(match2, 'Should match longer parameterized path')
  assert.deepEqual(match2.params, { slug: 'another-show' })

  const noMatch = router.match('GET', '/api/shows/my-show/meta')
  assert.equal(noMatch, null, 'Should not match different pattern')
})

test('RouteMatcher - multiple parameters', () => {
  const router = createRouter([
    { method: 'GET', path: '/api/shows/:slug/channels/:channel_id', handler: () => {} },
  ])

  const match = router.match('GET', '/api/shows/my-show/channels/ch-1')
  assert.ok(match, 'Should match multiple params')
  assert.deepEqual(match.params, { slug: 'my-show', channel_id: 'ch-1' })
})

test('RouteMatcher - flattens nested route arrays', () => {
  const authRoutes = [
    { method: 'POST', path: '/api/auth/login', handler: () => {} },
    { method: 'POST', path: '/api/auth/refresh', handler: () => {} },
  ]
  const showRoutes = [
    { method: 'GET', path: '/api/shows', handler: () => {} },
  ]

  const router = createRouter([authRoutes, showRoutes])

  assert.ok(router.match('POST', '/api/auth/login'))
  assert.ok(router.match('GET', '/api/shows'))
  assert.equal(router.routes.length, 3, 'Should flatten all routes')
})
