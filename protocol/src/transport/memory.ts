import { Emitter } from "./emitter.ts";
import type { Role, Transport, TransportState } from "./types.ts";

/** Two connected in-process transports, for tests and single-page harnesses. */
export function createMemoryTransportPair(): { companion: Transport; watch: Transport } {
  const make = (role: Role) => ({
    role,
    frames: new Emitter<string>(),
    peers: new Emitter<boolean>(),
    states: new Emitter<TransportState>(),
    open: true,
  });
  const a = make("companion");
  const b = make("watch");

  const wrap = (self: ReturnType<typeof make>, other: ReturnType<typeof make>): Transport => ({
    role: self.role,
    get state(): TransportState {
      return self.open ? "open" : "closed";
    },
    get peerConnected() {
      return self.open && other.open;
    },
    send(text: string) {
      if (!self.open || !other.open) return;
      queueMicrotask(() => other.frames.emit(text));
    },
    onFrame: (listener) => self.frames.on(listener),
    onPeer: (listener) => self.peers.on(listener),
    onState: (listener) => self.states.on(listener),
    close() {
      if (!self.open) return;
      self.open = false;
      self.states.emit("closed");
      other.peers.emit(false);
    },
  });

  return { companion: wrap(a, b), watch: wrap(b, a) };
}
