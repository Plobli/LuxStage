const store = new Map()

export function cached(key, fetcher, ttlMs = 30_000) {
  const entry = store.get(key)
  if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data)
  const promise = fetcher().then(data => {
    store.set(key, { data, ts: Date.now() })
    return data
  })
  return promise
}

export function invalidate(key) {
  store.delete(key)
}

export function invalidateAll() {
  store.clear()
}
