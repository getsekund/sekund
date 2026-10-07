import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TransportState, WatchStatus } from "@sekund/protocol";

function Dot({ on }: { on: boolean }) {
  return <span className={cn("inline-block size-2 rounded-full", on ? "bg-emerald-500" : "bg-muted-foreground/40")} />;
}

export function ConnectionStatus({ relay, watchConnected, watchStatus }: { relay: TransportState; watchConnected: boolean; watchStatus: WatchStatus | null }) {
  const session = watchStatus ? (watchStatus.session === "OPEN" ? "unlocked" : "locked") : null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant="outline" className="gap-1.5">
        <Dot on={relay === "open"} /> Link {relay === "open" ? "up" : relay}
      </Badge>
      <Badge variant="outline" className="gap-1.5">
        <Dot on={watchConnected} /> Watch {watchConnected ? (session ?? "connected") : "not connected"}
      </Badge>
      <Badge className="bg-violet-600 text-white hover:bg-violet-600">Devnet</Badge>
    </div>
  );
}
