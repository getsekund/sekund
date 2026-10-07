import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Droplets, ExternalLink, RefreshCw } from "lucide-react";
import { address as toAddress } from "@solana/kit";
import { formatLamports, type GetAddressResult } from "@sekund/protocol";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEVNET_FAUCET_URL, explorerAddressUrl, getBalance, requestAirdrop, type DevnetRpc } from "@/lib/solana";

interface Props {
  rpc: DevnetRpc;
  wallet: GetAddressResult | null;
  balance: bigint | null;
  onBalance: (balance: bigint | null) => void;
}

type FundState = { kind: "idle" } | { kind: "requesting" } | { kind: "ok" } | { kind: "limited"; message: string } | { kind: "error"; message: string };

export function WalletCard({ rpc, wallet, balance, onBalance }: Props) {
  const addr = wallet?.status === "OK" ? wallet.address! : null;
  const [copied, setCopied] = useState(false);
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

  const copy = async () => {
    if (!addr) return;
    await navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Watch wallet
          {wallet?.profile && (
            <Badge variant="secondary" className="font-mono">
              {wallet.profile} · {wallet.maxMessageBytes} B
            </Badge>
          )}
        </CardTitle>
        <CardDescription>The address comes from the watch. Its key never leaves the simulated secure element.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!addr ? (
          <p className="text-sm text-muted-foreground">
            {wallet?.status === "LOCKED"
              ? "The watch is locked. Enter the PIN on the watch to share its address."
              : wallet?.status === "NO_WALLET"
                ? "The watch has no wallet yet. Create one on the watch first."
                : "Waiting for the watch to share its address."}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-sm" title={addr}>
                {addr}
              </code>
              <Button size="icon" variant="ghost" onClick={copy} aria-label="Copy address">
                {copied ? <Check /> : <Copy />}
              </Button>
              <Button size="icon" variant="ghost" asChild aria-label="Open in explorer">
                <a href={explorerAddressUrl(addr)} target="_blank" rel="noreferrer">
                  <ExternalLink />
                </a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Devnet balance</div>
                <div className="font-mono text-2xl tabular-nums">{balance === null ? "—" : `${formatLamports(balance)} SOL`}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                  <RefreshCw className={loading ? "animate-spin" : ""} /> Refresh
                </Button>
                <Button size="sm" onClick={airdrop} disabled={fund.kind === "requesting"}>
                  <Droplets /> {fund.kind === "requesting" ? "Requesting…" : "Airdrop devnet SOL"}
                </Button>
              </div>
            </div>
            {fund.kind === "ok" && <p className="text-sm text-emerald-600 dark:text-emerald-400">Airdrop confirmed.</p>}
            {(fund.kind === "limited" || fund.kind === "error") && (
              <Alert>
                <Droplets />
                <AlertTitle>{fund.kind === "limited" ? "Faucet is rate-limited" : "Airdrop failed"}</AlertTitle>
                <AlertDescription>
                  <p>
                    {fund.message} Copy the address above, request devnet SOL at{" "}
                    <a className="underline" href={DEVNET_FAUCET_URL} target="_blank" rel="noreferrer">
                      faucet.solana.com
                    </a>{" "}
                    (choose Devnet), then press Refresh.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
