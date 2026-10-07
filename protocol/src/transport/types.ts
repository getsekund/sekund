export type Role = "companion" | "watch";

export type TransportState = "connecting" | "open" | "closed";

/**
 * A text-frame channel standing in for the BLE GATT link. It carries protocol frames
 * verbatim and is untrusted: security never depends on it.
 */
export interface Transport {
  readonly role: Role;
  readonly state: TransportState;
  /** True while at least one client of the opposite role is connected. */
  readonly peerConnected: boolean;
  send(text: string): void;
  onFrame(listener: (text: string) => void): () => void;
  onPeer(listener: (connected: boolean) => void): () => void;
  onState(listener: (state: TransportState) => void): () => void;
  close(): void;
}

/** Control frame sent by the relay itself, never by the peer. */
export interface RelayPeerEvent {
  relay: 1;
  event: "peer";
  role: Role;
  connected: boolean;
  count: number;
}

export function oppositeRole(role: Role): Role {
  return role === "companion" ? "watch" : "companion";
}
