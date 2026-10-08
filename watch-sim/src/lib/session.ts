import {
  DEFAULT_ROOM_ID,
  createPeerIdentity,
  loadOrCreateDeviceId,
  loadStoredRoomId,
  newSessionId,
  resolveRoomId,
  storeRoomId,
  type PeerIdentity,
} from '@sekund/protocol'

/** Resolve room + persistent device id for this browser origin; fresh session each load. */
export function watchIdentityFromLocation(search = typeof location !== 'undefined' ? location.search : ''): PeerIdentity {
  const storage = typeof localStorage !== 'undefined' ? localStorage : memoryStorage()
  const roomId = resolveRoomId(search, loadStoredRoomId(storage))
  storeRoomId(storage, roomId)
  const deviceId = loadOrCreateDeviceId(storage)
  return createPeerIdentity(roomId, deviceId, newSessionId())
}

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    key: () => null,
  }
}

export { DEFAULT_ROOM_ID }
