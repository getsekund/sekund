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
        <div className="rounded-sk bg-paper-2 p-4 text-14">
          {wallet?.status === "LOCKED" || watchStatus?.session === "CLOSED" ? (
            <p>The watch is locked. Open Secure Mode and enter the PIN on the watch to share its address.</p>
          ) : wallet?.status === "NO_WALLET" ? (
            <p>The watch has no key yet. Set it up on the watch first.</p>
          ) : (
            <div className="flex items-center gap-3" data-testid="watch-asking">
              <DotLoader label="Asking the watch" />
              <p>Asking the watch for its address.</p>
            </div>
          )}
        </div>
      ) : (
        <dl className="text-14">
          <div className="grid grid-cols-[76px_1fr] gap-3 border-t border-rule py-2">
            <dt className="text-graphite">Address</dt>
            <dd className="space-y-2">
              <span className="block font-mono text-[13.5px] leading-body" data-testid="watch-address" data-address={addr}>
                {groupAddress(addr)}
              </span>
              <span className="flex flex-wrap gap-2">
                <CopyButton value={addr} label="Copy address" />
                <ExplorerButton href={explorerAddressUrl(addr)} />
              </span>
            </dd>
          </div>
          <div className="grid grid-cols-[76px_1fr] gap-3 border-t border-rule py-2">
            <dt className="text-graphite">Balance</dt>
            <dd className="space-y-2">
              <span className="block font-mono text-[13.5px] tabular">{balance === null ? "Unknown" : `${formatLamports(balance)} SOL`}</span>
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
          {wallet?.profile && (
            <div className="grid grid-cols-[76px_1fr] gap-3 border-t border-rule py-2">
              <dt className="text-graphite">Signer</dt>
              <dd className="font-mono text-[13.5px]">
                {wallet.profile} simulated, {wallet.maxMessageBytes} B max
              </dd>
            </div>
          )}
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
