import { useState, type Ref } from "react";
import type { Address } from "@solana/kit";
import { randomBytes, toBase58 } from "@sekund/protocol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseAddress, parseSol } from "@/lib/solana";
import { cn } from "@/lib/utils";

const FEE_LAMPORTS = 5_000n;

/** Devnet recipient of the recorded proof run (README). Prefilled so the demo flows without typing. */
export const DEMO_RECIPIENT = "5awdRY3zVWWNZXmHH955bDxdUoZ7aFqjKKaCeCeBuAbg";
export const DEMO_AMOUNTS = ["0.01", "0.05", "0.1"] as const;

interface Props {
  from: string | null;
  balance: bigint | null;
  busy: boolean;
  blockedReason: string | null;
  onSend: (to: Address, lamports: bigint) => void;
  toRef?: Ref<HTMLInputElement>;
}

export function TransferForm({ from, balance, busy, blockedReason, onSend, toRef }: Props) {
  const [to, setTo] = useState(DEMO_RECIPIENT);
  const [amount, setAmount] = useState<string>(DEMO_AMOUNTS[0]);
  const [touched, setTouched] = useState({ to: false, amount: false });

  const toAddress = parseAddress(to.trim());
  const lamports = parseSol(amount.trim());
  const toError = !toAddress
    ? to.trim()
      ? "This is not a Solana address. Check for a missing or extra character."
      : "Enter the address that receives the SOL."
    : toAddress === from
      ? "This is the watch's own address. Choose another recipient."
      : null;
  const amountError = lamports === null ? "Enter an amount above 0 with at most 9 decimals, for example 0.01." : null;
  const insufficient = lamports !== null && balance !== null && balance < lamports + FEE_LAMPORTS;

  const reason = busy
    ? "Finish the current request on the watch first."
    : (blockedReason ?? (toError || amountError ? "Fix the fields above." : insufficient ? "Not enough devnet SOL on the watch address. Press Get devnet SOL." : null));
  const canSend = !reason && toAddress !== null && lamports !== null;

  return (
    <section aria-labelledby="transfer-heading" className="space-y-4">
      <h2 id="transfer-heading" className="text-20 leading-snug font-semibold">
        Transfer
      </h2>
      <form
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setTouched({ to: true, amount: true });
          if (canSend) onSend(toAddress!, lamports!);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="to">To</Label>
          <Input
            ref={toRef}
            id="to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, to: true }))}
            className="font-mono"
            aria-invalid={touched.to && !!toError}
            aria-describedby="to-help"
            autoComplete="off"
            spellCheck={false}
          />
          <p id="to-help" className={cn("text-14", touched.to && toError ? "text-spot" : "text-graphite")}>
            {touched.to && toError ? toError : "A devnet address. Prefilled with the demo recipient."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="small" onClick={() => setTo(DEMO_RECIPIENT)}>
              Demo recipient
            </Button>
            <Button type="button" variant="small" onClick={() => setTo(toBase58(randomBytes(32)))}>
              New test address
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="amount">Amount (SOL)</Label>
          <Input
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
            inputMode="decimal"
            className="font-mono tabular"
            aria-invalid={touched.amount && !!amountError}
            aria-describedby="amount-help"
            autoComplete="off"
          />
          <p id="amount-help" className={cn("text-14", touched.amount && amountError ? "text-spot" : "text-graphite")}>
            {touched.amount && amountError ? amountError : "Devnet SOL. The network fee is 0.000005 SOL."}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Demo amounts">
            {DEMO_AMOUNTS.map((value) => (
              <Button key={value} type="button" variant="small" className="font-mono tabular" aria-pressed={amount === value} onClick={() => setAmount(value)}>
                {value}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <Button type="submit" className="w-full sm:w-auto" disabled={!canSend} aria-describedby={reason ? "send-reason" : undefined}>
            Send to watch
          </Button>
          {reason && (
            <p id="send-reason" className="text-14 text-graphite" data-testid="send-reason">
              {reason}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
