const store = new Map<string, { data: any, ts: number }>()

export function cached<T>(key: string, fetcher: () => Promise<T>, ttlMs = 30_000): Promise<T> {
  const entry = store.get(key)
  if (entry && Date.now() - entry.ts < ttlMs) return Promise.resolve(entry.data as T)
  const promise = fetcher().then(data => {
    store.set(key, { data, ts: Date.now() })
    return data
  })
  return promise
}

export function invalidate(key: string): void {
  store.delete(key)
}

export function invalidateAll(): void {
  store.clear()
}

