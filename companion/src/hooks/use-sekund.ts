import { useCallback, useEffect, useRef, useState } from "react";
import { createRelayTransport, type GetAddressResult, type TransportState, type WatchStatus } from "@sekund/protocol";
import { SekundClient } from "@/lib/sekund-client";

export interface SekundConnection {
  client: SekundClient | null;
  relay: TransportState;
  watchConnected: boolean;
  watchStatus: WatchStatus | null;
  wallet: GetAddressResult | null;
  refreshWallet: () => Promise<void>;
}

export function useSekund(): SekundConnection {
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
    const transport = createRelayTransport({ role: "companion" });
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
  }, [refreshWallet]);

  return { client, relay, watchConnected, watchStatus, wallet, refreshWallet };
}
