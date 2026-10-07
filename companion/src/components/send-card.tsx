import { useState } from "react";
import { Send, Shuffle } from "lucide-react";
import { toBase58, randomBytes } from "@sekund/protocol";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseAddress, parseSol } from "@/lib/solana";
import type { Address } from "@solana/kit";

const FEE_LAMPORTS = 5_000n;

interface Props {
  from: string | null;
  balance: bigint | null;
  busy: boolean;
  blockedReason: string | null;
  onSend: (to: Address, lamports: bigint) => void;
}

export function SendCard({ from, balance, busy, blockedReason, onSend }: Props) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("0.01");

  const toAddress = parseAddress(to);
  const lamports = parseSol(amount);
  const toError = to && !toAddress ? "Not a valid Solana address." : toAddress && toAddress === from ? "Choose an address other than the watch." : null;
  const amountError = amount && lamports === null ? "Enter a positive amount, up to 9 decimals." : null;
  const insufficient = lamports !== null && balance !== null && balance < lamports + FEE_LAMPORTS;

  const reason = blockedReason ?? (insufficient ? "Not enough devnet SOL. Fund the watch address first." : null);
  const canSend = !busy && !reason && toAddress && !toError && lamports !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send devnet SOL</CardTitle>
        <CardDescription>The companion builds the transfer; only the watch can approve and sign it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) onSend(toAddress!, lamports!);
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="to">Destination</Label>
            <div className="flex gap-2">
              <Input id="to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Devnet address" className="font-mono" aria-invalid={!!toError} autoComplete="off" spellCheck={false} />
              <Button type="button" variant="outline" onClick={() => setTo(toBase58(randomBytes(32)))} title="Generate a fresh test address">
                <Shuffle /> <span className="hidden sm:inline">Test address</span>
              </Button>
            </div>
            {toError && <p className="text-sm text-destructive">{toError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (SOL)</Label>
            <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="font-mono" aria-invalid={!!amountError} />
            {amountError && <p className="text-sm text-destructive">{amountError}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={!canSend}>
            <Send /> {busy ? "Request in progress…" : "Send to watch for approval"}
          </Button>
          {reason && <p className="text-center text-sm text-muted-foreground">{reason}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
