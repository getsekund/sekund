import { CheckCircle2, CircleAlert, ExternalLink, Loader2, RotateCcw, Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNow } from "@/hooks/use-now";
import { explorerTxUrl } from "@/lib/solana";
import type { FlowOutcome, FlowStage } from "@/lib/transfer-flow";

export type Activity = { kind: "idle" } | { kind: "running"; stage: FlowStage } | { kind: "done"; outcome: FlowOutcome };

const REFUSAL_TEXT: Record<string, string> = {
  REJECTED: "Rejected on the watch. Nothing was signed.",
  EXPIRED: "The review window ran out before approval, so the watch discarded the request. A retry fetches a fresh blockhash and needs a new review.",
  TOO_LARGE: "The message is larger than the secure element accepts. It was refused before display.",
  UNSUPPORTED: "The watch only signs a single devnet SOL transfer from its own address.",
  LOCKED: "The watch is locked or its session ended. Enter the PIN on the watch and try again.",
  REPLAYED: "The watch refused a request it had already seen.",
  BUSY: "The watch is already reviewing another request.",
  INVALID: "The watch could not read the request.",
};

function Countdown({ deadline }: { deadline: number }) {
  const now = useNow(true);
  const total = 60_000;
  const left = Math.max(0, deadline - now);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">Approve on the watch within</span>
        <span className="font-mono text-3xl tabular-nums">{Math.ceil(left / 1000)}s</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${Math.min(100, (left / total) * 100)}%` }} />
      </div>
    </div>
  );
}

export function RequestStatus({ activity, onRetry }: { activity: Activity; onRetry: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Request</CardTitle>
        <CardDescription>Each request uses a blockhash fetched just before sending, so the review window is under a minute.</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.kind === "idle" && <p className="text-sm text-muted-foreground">No request yet. Build a transfer to send it to the watch for review.</p>}
        {activity.kind === "running" && <RunningStage stage={activity.stage} />}
        {activity.kind === "done" && <Outcome outcome={activity.outcome} onRetry={onRetry} />}
      </CardContent>
    </Card>
  );
}

function RunningStage({ stage }: { stage: FlowStage }) {
  if (stage.stage === "awaiting-approval") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Watch className="size-4" /> Sent {stage.messageLength}-byte message. Review destination and amount on the watch.
        </div>
        <Countdown deadline={stage.deadline} />
      </div>
    );
  }
  const label =
    stage.stage === "fetching-blockhash"
      ? "Fetching a fresh blockhash…"
      : stage.stage === "verifying"
        ? "Verifying the signature against the exact message bytes and the watch address…"
        : stage.stage === "broadcasting"
          ? "Broadcasting to devnet…"
          : "Waiting for confirmation…";
  return (
    <div className="flex items-center gap-2 text-sm">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

function Outcome({ outcome, onRetry }: { outcome: FlowOutcome; onRetry: () => void }) {
  if (outcome.kind === "confirmed") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-5" /> Confirmed on devnet
        </div>
        <code className="block break-all rounded-md bg-muted/50 p-2 font-mono text-xs">{outcome.signature}</code>
        <Button asChild variant="outline" size="sm">
          <a href={outcome.explorerUrl} target="_blank" rel="noreferrer">
            <ExternalLink /> View in Solana Explorer
          </a>
        </Button>
      </div>
    );
  }

  const [title, detail, retry] =
    outcome.kind === "watch-refused"
      ? [outcome.status, REFUSAL_TEXT[outcome.status] ?? outcome.reason ?? "", outcome.status === "EXPIRED"]
      : outcome.kind === "timeout"
        ? ["No answer", "The watch did not answer before the request expired. Is the watch simulator open?", true]
        : outcome.kind === "verification-failed"
          ? ["Signature refused", "The returned signature does not match the message and the watch address. Nothing was broadcast.", false]
          : outcome.kind === "chain-expired"
            ? ["Blockhash expired", "The network did not confirm before the blockhash expired.", true]
            : outcome.kind === "chain-failed"
              ? ["Transaction failed", outcome.error, false]
              : ["Error", outcome.message, false];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 font-medium">
        <CircleAlert className="size-5 text-amber-600 dark:text-amber-400" /> {title}
      </div>
      <p className="text-sm text-muted-foreground">{detail}</p>
      {"signature" in outcome && (
        <a className="text-sm underline" href={explorerTxUrl(outcome.signature)} target="_blank" rel="noreferrer">
          View in explorer
        </a>
      )}
      {retry && (
        <Button size="sm" onClick={onRetry}>
          <RotateCcw /> Build a new request
        </Button>
      )}
    </div>
  );
}
