/**
 * One active watch runtime per origin. Prefer Web Locks; fall back to
 * BroadcastChannel + localStorage when locks are unavailable.
 */

export type LeaseHandle = { release(): void }

const LOCK_NAME = 'sekund-watch-runtime'
const BC_NAME = 'sekund-watch-lease'
const LS_KEY = 'sekund-watch-lease-owner'
const HEARTBEAT_MS = 1_500
const STALE_MS = 4_000

export function acquireWatchLease(): Promise<LeaseHandle | null> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks) {
    return acquireViaWebLocks()
  }
  return Promise.resolve(acquireViaFallback())
}

function acquireViaWebLocks(): Promise<LeaseHandle | null> {
  return new Promise((resolve) => {
    let settleRelease!: () => void
    const held = new Promise<void>((r) => {
      settleRelease = r
    })
    void navigator.locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock) {
        resolve(null)
        return
      }
      resolve({
        release() {
          settleRelease()
        },
      })
      await held
    })
  })
}

function acquireViaFallback(): LeaseHandle | null {
  const id = crypto.randomUUID()
  const now = Date.now()
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const prev = JSON.parse(raw) as { id: string; at: number }
      if (prev.id !== id && now - prev.at < STALE_MS) return null
    }
    localStorage.setItem(LS_KEY, JSON.stringify({ id, at: now }))
  } catch {
    return null
  }

  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(BC_NAME) : null
  const beat = window.setInterval(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw && (JSON.parse(raw) as { id: string }).id !== id) return
      localStorage.setItem(LS_KEY, JSON.stringify({ id, at: Date.now() }))
    } catch {
      /* ignore */
    }
  }, HEARTBEAT_MS)

  return {
    release() {
      window.clearInterval(beat)
      bc?.close()
      try {
        const raw = localStorage.getItem(LS_KEY)
        if (raw && (JSON.parse(raw) as { id: string }).id === id) localStorage.removeItem(LS_KEY)
      } catch {
        /* ignore */
      }
    },
  }
}
