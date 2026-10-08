import {
  createPeerIdentity,
  loadOrCreateDeviceId,
  loadStoredRoomId,
  newSessionId,
  resolveRoomId,
  storeRoomId,
  type PeerIdentity,
} from "@sekund/protocol";

export function companionIdentityFromLocation(search = typeof location !== "undefined" ? location.search : ""): PeerIdentity {
  const storage =
    typeof localStorage !== "undefined"
      ? localStorage
      : {
          getItem: () => null,
          setItem: () => undefined,
        };
  const roomId = resolveRoomId(search, loadStoredRoomId(storage as Storage));
  storeRoomId(storage as Storage, roomId);
  return createPeerIdentity(roomId, loadOrCreateDeviceId(storage as Storage), newSessionId());
}
