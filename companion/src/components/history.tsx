import { ExternalLink } from "lucide-react";
import { formatLamports } from "@sekund/protocol";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FlowOutcome } from "@/lib/transfer-flow";

export interface HistoryEntry {
  at: number;
  to: string;
  lamports: bigint;
  outcome: FlowOutcome;
}

function label(outcome: FlowOutcome): string {
  switch (outcome.kind) {
    case "confirmed":
      return "Confirmed";
    case "watch-refused":
      return outcome.status.charAt(0) + outcome.status.slice(1).toLowerCase().replace("_", " ");
    case "timeout":
      return "No answer";
    case "verification-failed":
      return "Signature refused";
    case "chain-expired":
      return "Blockhash expired";
    case "chain-failed":
      return "Failed on chain";
    default:
      return "Error";
  }
}

export function History({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>This session</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {entries.map((entry) => (
            <li key={entry.at} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="font-mono tabular-nums">{formatLamports(entry.lamports)} SOL</div>
                <div className="truncate font-mono text-xs text-muted-foreground">to {entry.to}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={entry.outcome.kind === "confirmed" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>{label(entry.outcome)}</span>
                {entry.outcome.kind === "confirmed" && (
                  <a href={entry.outcome.explorerUrl} target="_blank" rel="noreferrer" aria-label="View in explorer">
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
