import type { PeerIdentity } from "../identity.ts";

export type Role = "companion" | "watch";

export type TransportState = "connecting" | "open" | "closed" | "rejected";

/**
 * A text-frame channel standing in for the BLE GATT link. It carries protocol frames
 * verbatim and is untrusted: security never depends on it.
 */
export interface Transport {
  readonly role: Role;
  readonly state: TransportState;
  /** True while the opposite role is bound in this room. */
  readonly peerConnected: boolean;
  /** Bound peer identity once the opposite role is connected; null otherwise. */
  readonly peerIdentity: PeerIdentity | null;
  /** This client's identity for the room. */
  readonly identity: PeerIdentity;
  send(text: string): void;
  onFrame(listener: (text: string) => void): () => void;
  onPeer(listener: (connected: boolean, peer: PeerIdentity | null) => void): () => void;
  onState(listener: (state: TransportState) => void): () => void;
  close(): void;
}

/** Control frames sent by the relay itself, never by the peer. */
export type RelayControlEvent =
  | {
      relay: 1;
      event: "peer";
      role: Role;
      connected: boolean;
      count: 0 | 1;
      roomId: string;
      /** Present when connected is true. */
      peer?: PeerIdentity;
    }
  | {
      relay: 1;
      event: "rejected";
      role: Role;
      roomId: string;
      reason: string;
    };

export function oppositeRole(role: Role): Role {
  return role === "companion" ? "watch" : "companion";
}
