import { useCallback, useMemo, useState } from "react";
import { address as toAddress, type Address } from "@solana/kit";
import { ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConnectionStatus } from "@/components/connection-status";
import { History, type HistoryEntry } from "@/components/history";
import { RequestStatus, type Activity } from "@/components/request-status";
import { SendCard } from "@/components/send-card";
import { WalletCard } from "@/components/wallet-card";
import { useSekund } from "@/hooks/use-sekund";
import { broadcastAndConfirm, createDevnetRpc, fetchLifetime, getBalance } from "@/lib/solana";
import { sendTransfer } from "@/lib/transfer-flow";

const WATCH_URL = "http://localhost:4318";

export default function App() {
  const rpc = useMemo(() => createDevnetRpc(), []);
  const { client, relay, watchConnected, watchStatus, wallet } = useSekund();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [activity, setActivity] = useState<Activity>({ kind: "idle" });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [last, setLast] = useState<{ to: Address; lamports: bigint } | null>(null);

  const from = wallet?.status === "OK" ? wallet.address! : null;
  const busy = activity.kind === "running";

  const send = useCallback(
    async (to: Address, lamports: bigint) => {
      if (!client || !from) return;
      setLast({ to, lamports });
      setActivity({ kind: "running", stage: { stage: "fetching-blockhash" } });
      const outcome = await sendTransfer(
        {
          client,
          fetchLifetime: () => fetchLifetime(rpc),
          broadcast: (wire, lvbh) => broadcastAndConfirm(rpc, wire, lvbh, { onSent: (signature) => setActivity({ kind: "running", stage: { stage: "confirming", signature } }) }),
          onStage: (stage) => setActivity({ kind: "running", stage }),
        },
        { from: toAddress(from), to, lamports },
      );
      setActivity({ kind: "done", outcome });
      setHistory((h) => [{ at: Date.now(), to, lamports, outcome }, ...h].slice(0, 20));
      if (outcome.kind === "confirmed") setBalance(await getBalance(rpc, toAddress(from)).catch(() => null));
    },
    [client, from, rpc],
  );

  const blockedReason =
    relay !== "open"
      ? "The local link is down."
      : !watchConnected
        ? "Open the watch simulator to connect."
        : !from
          ? "Unlock the watch to share its address."
          : null;

  return (
    <div className="min-h-svh bg-gradient-to-b from-muted/60 to-background">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-[0.3em]">SEKUND</h1>
            <p className="text-sm text-muted-foreground">Companion · devnet signing requests to your watch</p>
          </div>
          <ConnectionStatus relay={relay} watchConnected={watchConnected} watchStatus={watchStatus} />
        </header>

        {relay !== "open" && (
          <Alert className="mb-6">
            <AlertTitle>Local link not running</AlertTitle>
            <AlertDescription>
              <p>
                Start it with <code className="font-mono">pnpm relay</code> (or <code className="font-mono">pnpm dev</code>). It stands in for Bluetooth between this app and the watch. Reconnecting automatically.
              </p>
            </AlertDescription>
          </Alert>
        )}
        {relay === "open" && !watchConnected && (
          <Alert className="mb-6">
            <AlertTitle>Watch not connected</AlertTitle>
            <AlertDescription>
              <p>
                Open the watch simulator at{" "}
                <a className="underline" href={WATCH_URL} target="_blank" rel="noreferrer">
                  {WATCH_URL}
                </a>{" "}
                in another window.
              </p>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <WalletCard rpc={rpc} wallet={wallet} balance={balance} onBalance={setBalance} />
            <SendCard from={from} balance={balance} busy={busy} blockedReason={blockedReason} onSend={send} />
          </div>
          <div className="space-y-6">
            <RequestStatus activity={activity} onRetry={() => last && void send(last.to, last.lamports)} />
            <History entries={history} />
          </div>
        </div>

        <footer className="mt-10 flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <p>
            Proof of concept on Solana devnet only. The secure element is simulated in software in the watch simulator; the hardware is the roadmap. This app never sees a private key: it
            sends the exact message bytes, verifies the returned signature, and broadcasts.
          </p>
        </footer>
      </div>
    </div>
  );
}
