import { formatLamports } from "@sekund/protocol";
import { StatusChip } from "@/components/status-chip";
import { InlineError } from "@/components/inline-error";
import { CopyButton, ExplorerButton } from "@/components/link-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useNow } from "@/hooks/use-now";
import { describeRequest, formatCountdown, groupAddress, truncateSignature, type RequestEntry } from "@/lib/request-view";
import { explorerTxUrl } from "@/lib/solana";

interface Props {
  entry: RequestEntry;
  onAgain: (entry: RequestEntry) => void;
  onNew: () => void;
}

export function RequestCard({ entry, onAgain, onNew }: Props) {
  const sol = formatLamports(entry.lamports);
  const view = describeRequest(entry, sol);
  const waiting = entry.stage?.stage === "awaiting-approval" && !entry.outcome ? entry.stage : null;

  return (
    <Card data-testid="request-card" data-chip={view.chip} aria-label={`Transfer of ${sol} SOL, ${view.chip.toLowerCase()}`}>
      <CardHeader>
        <div className="min-w-0 space-y-0.5">
          <CardTitle>Transfer request</CardTitle>
          <CardDescription>{view.summary}</CardDescription>
        </div>
        <StatusChip word={view.chip} />
      </CardHeader>

      {waiting && <Countdown deadline={waiting.deadline} total={waiting.expiresInMs} />}

      <CardContent>
        <dl className="text-14">
          <Row label="To">
            <span className="font-mono text-[13.5px] leading-body">{groupAddress(entry.to)}</span>
          </Row>
          <Row label="Amount">
            <span className="font-mono text-[13.5px] tabular">{sol} SOL</span>
          </Row>
          <Row label="Network">
            <span className="font-mono text-[13.5px]">Devnet</span>
          </Row>
        </dl>
      </CardContent>

      {view.step && (
        <CardContent className="pb-3">
          {view.chip === "SENDING" && (
            <div className="mb-2 space-y-1.5 rounded-sk bg-paper-2 p-3" aria-hidden>
              <div className="h-3 w-3/4 rounded-sk bg-rule" />
              <div className="h-3 w-1/2 rounded-sk bg-rule" />
            </div>
          )}
          <p className="text-14 text-graphite" data-testid="request-step">
            {view.step}
          </p>
        </CardContent>
      )}

      {view.error && (
        <CardContent className="pb-3">
          <InlineError cause={view.error.cause}>{view.error.fix}</InlineError>
        </CardContent>
      )}

      {view.signature && (
        <div className="mx-[18px] mt-0.5 grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t border-line py-2.5" data-testid="signature-row" data-signature={view.signature}>
          <div className="min-w-0">
            <span className="block text-12 text-graphite">Signature</span>
            <span className="block truncate font-mono text-[13.5px]" title={view.signature}>
              {truncateSignature(view.signature)}
            </span>
          </div>
          <CopyButton value={view.signature} label="Copy signature" />
          <ExplorerButton href={explorerTxUrl(view.signature)} />
        </div>
      )}

      {view.action && (
        <CardFooter>
          <p className="text-14">{footerText(view.chip)}</p>
          {view.action === "new" ? (
            <Button variant="secondary" onClick={onNew}>
              New transfer
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => onAgain(entry)}>
              {view.action === "again" ? "Send again" : "Retry"}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

function footerText(chip: string): string {
  switch (chip) {
    case "CONFIRMED":
      return "Confirmed on devnet.";
    case "REJECTED":
    case "EXPIRED":
      return "A new request fetches a new blockhash.";
    default:
      return "Retry sends a new request.";
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_1fr] gap-3 border-t border-rule py-1.5">
      <dt className="text-graphite">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Countdown({ deadline, total }: { deadline: number; total: number }) {
  const now = useNow(true);
  const left = Math.max(0, deadline - now);
  return (
    <div className="mx-[18px] mb-3 space-y-2 rounded-sk bg-paper-2 p-3" role="timer" aria-label="Time left to approve on the watch">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-14 text-graphite">Approve on the watch within</span>
        <span className="font-mono text-32 leading-tight tabular" data-testid="countdown">
          {formatCountdown(left)}
        </span>
      </div>
      <div className="h-1 bg-rule">
        <div className="h-full bg-ink" style={{ width: `${Math.min(100, (left / total) * 100)}%` }} />
      </div>
    </div>
  );
}
