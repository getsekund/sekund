import { demoIdentity, type PeerIdentity } from "../identity.ts";
import { Emitter } from "./emitter.ts";
import type { Role, Transport, TransportState } from "./types.ts";

export interface MemoryTransportOptions {
  companion?: PeerIdentity;
  watch?: PeerIdentity;
}

/** Two connected in-process transports, for tests and single-page harnesses. */
export function createMemoryTransportPair(options: MemoryTransportOptions = {}): { companion: Transport; watch: Transport } {
  const companionIdentity = options.companion ?? demoIdentity("companion");
  const watchIdentity = options.watch ?? demoIdentity("watch", companionIdentity.roomId);

  const make = (role: Role, identity: PeerIdentity) => ({
    role,
    identity,
    frames: new Emitter<string>(),
    peers: new Emitter<{ connected: boolean; peer: PeerIdentity | null }>(),
    states: new Emitter<TransportState>(),
    open: true,
  });
  const a = make("companion", companionIdentity);
  const b = make("watch", watchIdentity);

  const wrap = (self: ReturnType<typeof make>, other: ReturnType<typeof make>): Transport => ({
    role: self.role,
    identity: self.identity,
    get state(): TransportState {
      return self.open ? "open" : "closed";
    },
    get peerConnected() {
      return self.open && other.open;
    },
    get peerIdentity() {
      return self.open && other.open ? other.identity : null;
    },
    send(text: string) {
      if (!self.open || !other.open) return;
      queueMicrotask(() => other.frames.emit(text));
    },
    onFrame: (listener) => self.frames.on(listener),
    onPeer: (listener) => self.peers.on(({ connected, peer }) => listener(connected, peer)),
    onState: (listener) => self.states.on(listener),
    close() {
      if (!self.open) return;
      self.open = false;
      self.states.emit("closed");
      other.peers.emit({ connected: false, peer: null });
    },
  });

  return { companion: wrap(a, b), watch: wrap(b, a) };
}
