import { useCallback, useEffect, useState } from "react";
import { address as toAddress } from "@solana/kit";
import { formatLamports, type GetAddressResult, type TransportState, type WatchStatus } from "@sekund/protocol";
import { DotLoader } from "@/components/dot-loader";
import { InlineError } from "@/components/inline-error";
import { Button } from "@/components/ui/button";
import { groupAddress } from "@/lib/request-view";
import { DEVNET_FAUCET_URL, explorerAddressUrl, getBalance, requestAirdrop, type DevnetRpc } from "@/lib/solana";
import { CopyButton, ExplorerButton } from "@/components/link-buttons";

interface Props {
  rpc: DevnetRpc;
  relay: TransportState;
  watchConnected: boolean;
  watchStatus: WatchStatus | null;
  wallet: GetAddressResult | null;
  watchUrl: string;
  balance: bigint | null;
  onBalance: (balance: bigint | null) => void;
}

type FundState = { kind: "idle" } | { kind: "requesting" } | { kind: "ok" } | { kind: "limited"; message: string } | { kind: "error"; message: string };

export function WatchPanel({ rpc, relay, watchConnected, watchStatus, wallet, watchUrl, balance, onBalance }: Props) {
  const addr = wallet?.status === "OK" ? wallet.address! : null;
  const [loading, setLoading] = useState(false);
  const [fund, setFund] = useState<FundState>({ kind: "idle" });

  const refresh = useCallback(async () => {
    if (!addr) return onBalance(null);
    setLoading(true);
    try {
      onBalance(await getBalance(rpc, toAddress(addr)));
    } catch {
      onBalance(null);
    } finally {
      setLoading(false);
    }
  }, [addr, rpc, onBalance]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const airdrop = async () => {
    if (!addr) return;
    setFund({ kind: "requesting" });
    let outcome = await requestAirdrop(rpc, toAddress(addr), 1_000_000_000n);
    if (!outcome.ok && outcome.rateLimited) outcome = await requestAirdrop(rpc, toAddress(addr), 100_000_000n);
    if (outcome.ok) setFund({ kind: "ok" });
    else setFund(outcome.rateLimited ? { kind: "limited", message: outcome.message } : { kind: "error", message: outcome.message });
    await refresh();
  };

  return (
    <section aria-labelledby="watch-heading" className="space-y-4">
      <h2 id="watch-heading" className="text-20 leading-snug font-semibold">
        Watch
      </h2>

      {relay !== "open" ? (
        <InlineError cause="The local link is not running.">
          It stands in for Bluetooth between this page and the watch. Start it with <code className="font-mono">pnpm dev</code> or{" "}
          <code className="font-mono">pnpm relay</code>. This page reconnects on its own.
        </InlineError>
      ) : !watchConnected ? (
        <div className="space-y-3 rounded-sk bg-paper-2 p-4" data-testid="no-watch">
          <p className="text-16">No watch connected.</p>
          <p className="text-14 text-graphite">
            Open the watch simulator in a second window and keep both open. The watch holds the key; this page only builds the transfer and broadcasts what the watch signed.
          </p>
          <Button asChild variant="small">
            <a href={watchUrl} target="_blank" rel="noopener">
              Open the simulator
            </a>
          </Button>
        </div>
      ) : !addr ? (
        wallet?.status === "NO_WALLET" ? (
          <div className="space-y-2 rounded-sk bg-paper-2 p-4" data-testid="needs-pin">
            <p className="text-16">Needs a PIN.</p>
            <p className="text-14 text-graphite">
              The watch has no key yet. Hold upper left (A) and lower right (D), choose four digits, then enter them again. This page asks for the address after that.
            </p>
          </div>
        ) : wallet?.status === "LOCKED" || watchStatus?.session === "CLOSED" ? (
          <div className="space-y-2 rounded-sk bg-paper-2 p-4" data-testid="needs-pin">
            <p className="text-16">Needs the PIN.</p>
            <p className="text-14 text-graphite">
              Hold upper left (A) and lower right (D) on the watch, then enter the four digits. This page cannot enter the PIN. It asks for the address once the watch is unlocked.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-sk bg-paper-2 p-4 text-16" data-testid="watch-asking">
            <DotLoader label="Asking the watch" />
            <p>Asking the watch for its address.</p>
          </div>
        )
      ) : (
        <dl className="bg-paper text-14">
          <div className="grid grid-cols-1 gap-2 border-t border-rule py-3 sm:grid-cols-[76px_1fr] sm:gap-3">
            <dt className="text-graphite">Address</dt>
            <dd className="min-w-0 space-y-2">
              <span className="block bg-paper font-mono text-16 leading-body break-words" data-testid="watch-address" data-address={addr}>
                {groupAddress(addr)}
              </span>
              <span className="flex flex-wrap gap-2">
                <CopyButton value={addr} label="Copy address" />
                <ExplorerButton href={explorerAddressUrl(addr)} />
              </span>
            </dd>
          </div>
          <div className="grid grid-cols-1 gap-2 border-t border-rule py-3 sm:grid-cols-[76px_1fr] sm:gap-3">
            <dt className="text-graphite">Balance</dt>
            <dd className="space-y-2">
              <span className="block bg-paper font-mono text-16 tabular">{balance === null ? "Unknown. Press Refresh." : `${formatLamports(balance)} SOL`}</span>
              <span className="flex flex-wrap gap-2">
                <Button variant="small" onClick={refresh} disabled={loading}>
                  {loading ? "Refreshing" : "Refresh"}
                </Button>
                <Button variant="small" onClick={airdrop} disabled={fund.kind === "requesting"}>
                  {fund.kind === "requesting" ? "Asking the faucet" : "Get devnet SOL"}
                </Button>
              </span>
            </dd>
          </div>
        </dl>
      )}

      {fund.kind === "ok" && <p className="text-14">Airdrop confirmed on devnet.</p>}
      {(fund.kind === "limited" || fund.kind === "error") && (
        <InlineError cause={fund.kind === "limited" ? "The devnet faucet is rate-limited." : "The airdrop failed."}>
          {fund.message} Copy the address, request devnet SOL at{" "}
          <a className="underline underline-offset-2" href={DEVNET_FAUCET_URL} target="_blank" rel="noopener">
            faucet.solana.com
          </a>{" "}
          (choose Devnet), then press Refresh.
        </InlineError>
      )}
    </section>
  );
}
