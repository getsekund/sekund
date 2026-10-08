import { useCallback, useMemo, useRef, useState } from "react";
import { address as toAddress, type Address } from "@solana/kit";
import { RequestList } from "@/components/request-list";
import { StatusChip } from "@/components/status-chip";
import { DarkGround, ThemeControl, ThemeRoot } from "@/components/theme-chrome";
import { TransferForm } from "@/components/transfer-form";
import { WatchPanel } from "@/components/watch-panel";
import { useSekund } from "@/hooks/use-sekund";
import { parseReviewCap, type RequestEntry } from "@/lib/request-view";
import { broadcastAndConfirm, createDevnetRpc, fetchLifetime, getBalance } from "@/lib/solana";
import { sendTransfer, type FlowStage } from "@/lib/transfer-flow";

const WATCH_URL = (() => {
  const room = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("room");
  return room ? `http://localhost:4318/?room=${encodeURIComponent(room)}` : "http://localhost:4318";
})();

export default function App() {
  const rpc = useMemo(() => createDevnetRpc(), []);
  const reviewCapMs = useMemo(() => parseReviewCap(window.location.search), []);
  const { client, relay, watchConnected, watchStatus, wallet } = useSekund();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [entries, setEntries] = useState<RequestEntry[]>([]);
  const nextId = useRef(1);
  const toInput = useRef<HTMLInputElement>(null);

  const from = wallet?.status === "OK" ? wallet.address! : null;
  const busy = entries.length > 0 && !entries[0]!.outcome;

  const update = useCallback((id: number, patch: (entry: RequestEntry) => Partial<RequestEntry>) => {
    setEntries((list) => list.map((entry) => (entry.id === id ? { ...entry, ...patch(entry) } : entry)));
  }, []);

  const send = useCallback(
    async (to: Address, lamports: bigint) => {
      if (!client || !from) return;
      const id = nextId.current++;
      setEntries((list) => [{ id, to, lamports, createdAt: Date.now() }, ...list].slice(0, 20));
      const onStage = (stage: FlowStage) =>
        update(id, (entry) => ({
          stage,
          ...(stage.stage === "awaiting-approval" ? { sentAt: Date.now() } : {}),
          ...(entry.stage?.stage === "awaiting-approval" && stage.stage !== "awaiting-approval" ? { answeredAt: Date.now() } : {}),
        }));
      const outcome = await sendTransfer(
        {
          client,
          fetchLifetime: () => fetchLifetime(rpc),
          broadcast: (wire, lvbh) => broadcastAndConfirm(rpc, wire, lvbh, { onSent: (signature) => onStage({ stage: "confirming", signature }) }),
          onStage,
          onBuilt: (info) => update(id, () => ({ to: info.to, lamports: info.lamports })),
          ...(reviewCapMs ? { maxExpiresInMs: reviewCapMs } : {}),
        },
        { from: toAddress(from), to, lamports },
      );
      update(id, (entry) => ({ outcome, ...(entry.answeredAt === undefined && entry.sentAt !== undefined ? { answeredAt: Date.now() } : {}) }));
      if (outcome.kind === "confirmed") setBalance(await getBalance(rpc, toAddress(from)).catch(() => null));
    },
    [client, from, rpc, reviewCapMs, update],
  );

  const blockedReason =
    relay !== "open"
      ? "The local link is not running."
      : !watchConnected
        ? "No watch connected. Open the watch simulator."
        : !from
          ? "Needs the PIN. Hold upper left (A) and lower right (D) on the watch, then enter the four digits."
          : null;

  return (
    <ThemeRoot>
    <DarkGround />
    <div className="min-h-svh">
      <header className="border-b border-rule">
        <div className="mx-auto flex min-h-14 max-w-(--sk-content-max) flex-wrap items-center justify-between gap-x-4 gap-y-2 px-(--sk-margin) py-2">
          <a href="/" className="sk-plate shrink-0" aria-label="SEKUND companion">
            <img src="/sekund-logo-v2.svg" alt="SEKUND" width={96} height={24} className="sk-logo h-6 w-24" />
          </a>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusChip word={relay === "open" && watchConnected ? "CONNECTED" : "NO WATCH"} />
            <span className="sk-plate font-mono text-14">Devnet</span>
            <a className="sk-plate text-14 underline-offset-4 hover:underline" href={WATCH_URL} target="_blank" rel="noopener">
              Simulator
            </a>
            <ThemeControl />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-(--sk-content-max) px-(--sk-margin) py-(--sk-space-6)">
        <div className="sk-plate mb-(--sk-space-6) max-w-[72ch] space-y-2">
          <h1 className="text-32 leading-tight font-semibold tracking-display">Send devnet SOL from the watch</h1>
          <p className="text-16 text-graphite">This page builds the transfer and broadcasts it. Only the watch can approve and sign it.</p>
        </div>

        <div className="grid gap-x-(--sk-gutter) gap-y-(--sk-space-7) lg:grid-cols-12">
          <div className="space-y-(--sk-space-6) lg:col-span-5">
            <WatchPanel
              rpc={rpc}
              relay={relay}
              watchConnected={watchConnected}
              watchStatus={watchStatus}
              wallet={wallet}
              watchUrl={WATCH_URL}
              balance={balance}
              onBalance={setBalance}
            />
            <TransferForm from={from} balance={balance} busy={busy} blockedReason={blockedReason} onSend={send} toRef={toInput} />
          </div>
          <div className="lg:col-span-7">
            <RequestList
              entries={entries}
              onAgain={(entry) => void send(toAddress(entry.to), entry.lamports)}
              onNew={() => toInput.current?.focus()}
            />
          </div>
        </div>
      </main>

      <footer className="mx-auto max-w-(--sk-content-max) px-(--sk-margin) pb-(--sk-space-7)">
        <p className="sk-plate max-w-[72ch] border-t border-rule pt-4 text-14 text-graphite">
          The secure element in this demo is simulated in software. The signatures are real, on Solana devnet only. This page never sees a private key: it sends the exact
          message bytes, verifies the returned signature, then broadcasts.
        </p>
      </footer>
    </div>
    </ThemeRoot>
  );
}
