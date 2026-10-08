import { useCallback, useEffect, useRef, useState } from "react";
import { createRelayTransport, type GetAddressResult, type TransportState, type WatchStatus } from "@sekund/protocol";
import { SekundClient } from "@/lib/sekund-client";
import { companionIdentityFromLocation } from "@/lib/session";

export interface SekundConnection {
  client: SekundClient | null;
  relay: TransportState;
  watchConnected: boolean;
  watchStatus: WatchStatus | null;
  wallet: GetAddressResult | null;
  roomId: string;
  refreshWallet: () => Promise<void>;
}

export function useSekund(): SekundConnection {
  const identity = companionIdentityFromLocation();
  const [client, setClient] = useState<SekundClient | null>(null);
  const [relay, setRelay] = useState<TransportState>("connecting");
  const [watchConnected, setWatchConnected] = useState(false);
  const [watchStatus, setWatchStatus] = useState<WatchStatus | null>(null);
  const [wallet, setWallet] = useState<GetAddressResult | null>(null);
  const clientRef = useRef<SekundClient | null>(null);

  const refreshWallet = useCallback(async () => {
    const current = clientRef.current;
    if (!current || !current.transport.peerConnected) {
      setWallet(null);
      return;
    }
    setWallet(await current.getAddress());
  }, []);

  useEffect(() => {
    const transport = createRelayTransport({ role: "companion", identity });
    const next = new SekundClient(transport);
    clientRef.current = next;
    setClient(next);
    const offState = transport.onState(setRelay);
    const offPeer = transport.onPeer((connected) => {
      setWatchConnected(connected);
      if (connected) void refreshWallet();
      else {
        setWatchStatus(null);
        setWallet(null);
      }
    });
    const offStatus = next.onWatchStatus((status) => {
      setWatchStatus(status);
      void refreshWallet();
    });
    return () => {
      offState();
      offPeer();
      offStatus();
      next.dispose();
      transport.close();
      clientRef.current = null;
    };
    // identity is stable for the page lifetime (sessionId fixed at mount).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshWallet]);

  return { client, relay, watchConnected, watchStatus, wallet, roomId: identity.roomId, refreshWallet };
}
