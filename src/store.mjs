export function memoryStore(now) {
  const rows = new Map()
  return {
    put(key, value, ttlMs) {
      rows.set(key, { value, exp: now() + ttlMs })
    },
    take(key) {
      const row = rows.get(key)
      if (!row) return null
      rows.delete(key)
      if (row.exp < now()) return null
      return row.value
    },
  }
}
