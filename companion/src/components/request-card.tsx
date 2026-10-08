import { formatLamports } from "@sekund/protocol";
import { StatusChip } from "@/components/status-chip";
import { InlineError } from "@/components/inline-error";
import { CopyButton, ExplorerButton } from "@/components/link-buttons";
import { DotLoader } from "@/components/dot-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useNow } from "@/hooks/use-now";
import { describeRequest, formatCountdown, groupAddress, statusLine, truncateSignature, type RequestEntry } from "@/lib/request-view";
import { explorerTxUrl } from "@/lib/solana";

interface Props {
  entry: RequestEntry;
  onAgain: (entry: RequestEntry) => void;
  onNew: () => void;
}

const valueClass = "font-mono text-16 leading-body break-words";

export function RequestCard({ entry, onAgain, onNew }: Props) {
  const sol = formatLamports(entry.lamports);
  const view = describeRequest(entry, sol);
  const waiting = entry.stage?.stage === "awaiting-approval" && !entry.outcome ? entry.stage : null;
  const line = statusLine(view);

  return (
    <Card data-testid="request-card" data-chip={view.chip} aria-label={`Transfer of ${sol} SOL, ${view.chip.toLowerCase()}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-[18px] pt-4">
        <StatusChip word={view.chip} />
        {view.chip === "WAITING" && <DotLoader label="Waiting for the watch" />}
      </div>

      {view.error ? (
        <div className="px-[18px] pt-3">
          <InlineError cause={view.error.cause}>{view.error.fix}</InlineError>
        </div>
      ) : (
        <p className="bg-paper px-[18px] pt-3 text-16" data-testid="request-status">
          {line}
        </p>
      )}

      {waiting && <Countdown deadline={waiting.deadline} total={waiting.expiresInMs} />}

      <CardContent className="pt-3">
        <dl className="bg-paper text-14">
          <Row label="To">
            <span className={valueClass}>{groupAddress(entry.to)}</span>
          </Row>
          <Row label="Amount">
            <span className={`${valueClass} tabular`}>{sol} SOL</span>
          </Row>
          <Row label="Network">
            <span className={valueClass}>Devnet</span>
          </Row>
        </dl>
      </CardContent>

      {view.chip === "SENDING" && (
        <div className="mx-[18px] mb-3 space-y-1.5 rounded-sk bg-paper-2 p-3" aria-hidden>
          <div className="h-3 w-3/4 rounded-sk bg-rule" />
          <div className="h-3 w-1/2 rounded-sk bg-rule" />
        </div>
      )}

      {view.signature && (
        <div className="mx-[18px] mt-0.5 flex flex-col gap-3 border-t border-line py-3 sm:flex-row sm:items-center" data-testid="signature-row" data-signature={view.signature}>
          <div className="min-w-0 flex-1 bg-paper">
            <span className="block text-12 text-graphite">Signature</span>
            <span className="block truncate font-mono text-16" title={view.signature}>
              {truncateSignature(view.signature)}
            </span>
          </div>
          <span className="flex flex-wrap gap-2">
            <CopyButton value={view.signature} label="Copy signature" />
            <ExplorerButton href={explorerTxUrl(view.signature)} />
          </span>
        </div>
      )}

      {view.action && (
        <CardFooter>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[76px_1fr] gap-3 border-t border-rule py-2">
      <dt className="pt-0.5 text-graphite">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Countdown({ deadline, total }: { deadline: number; total: number }) {
  const now = useNow(true);
  const left = Math.max(0, deadline - now);
  return (
    <div className="mx-[18px] mt-3 space-y-2 rounded-sk bg-paper-2 p-3" role="timer" aria-label="Time left to approve on the watch">
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
