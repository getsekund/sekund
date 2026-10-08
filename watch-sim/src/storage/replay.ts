import { REPLAY_TTL_MS, type ReplayJournal } from '@sekund/protocol'

const DB = 'sekund-watch-replay'
const STORE = 'tombstones'

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Watch-origin IndexedDB tombstones for requestId/nonce, kept for REPLAY_TTL_MS. */
export async function createIndexedDbReplayJournal(dbName = DB): Promise<ReplayJournal> {
  const open = indexedDB.open(dbName, 1)
  open.onupgradeneeded = () => {
    const db = open.result
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
  }
  const db = await req(open)

  const prune = async (now: number) => {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      const cursorReq = store.openCursor()
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (!cursor) return
        if ((cursor.value as { expiresAt: number }).expiresAt <= now) cursor.delete()
        cursor.continue()
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  return {
    async list() {
      const now = Date.now()
      await prune(now)
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const store = tx.objectStore(STORE)
        const out: string[] = []
        const cursorReq = store.openCursor()
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result
          if (!cursor) return
          out.push(String(cursor.key))
          cursor.continue()
        }
        tx.oncomplete = () => resolve(out)
        tx.onerror = () => reject(tx.error)
      })
    },
    async remember(value, expiresAt) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.objectStore(STORE).put({ expiresAt }, value)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    },
    prune,
  }
}

export { REPLAY_TTL_MS }
