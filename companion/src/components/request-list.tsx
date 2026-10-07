import { formatLamports } from "@sekund/protocol";
import { RequestCard } from "@/components/request-card";
import { describeRequest, type RequestEntry } from "@/lib/request-view";

interface Props {
  entries: RequestEntry[];
  onAgain: (entry: RequestEntry) => void;
  onNew: () => void;
}

export function RequestList({ entries, onAgain, onNew }: Props) {
  const latest = entries[0];
  return (
    <section aria-labelledby="requests-heading" className="space-y-4">
      <h2 id="requests-heading" className="text-20 leading-snug font-semibold">
        Requests
      </h2>
      <p className="sr-only" aria-live="polite">
        {latest ? describeRequest(latest, formatLamports(latest.lamports)).announce : ""}
      </p>
      {entries.length === 0 ? (
        <div className="space-y-1 rounded-sk bg-paper-2 p-5" data-testid="requests-empty">
          <p className="text-16">No requests yet.</p>
          <p className="text-14 text-graphite">Fill in the form and press Send to watch. Requests wait here until you approve or reject them on the watch.</p>
        </div>
      ) : (
        <ol className="space-y-4">
          {entries.map((entry) => (
            <li key={entry.id}>
              <RequestCard entry={entry} onAgain={onAgain} onNew={onNew} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
