import { cn } from "@/lib/utils";
import type { Chip } from "@/lib/request-view";

export type ChipWord = Chip | "NO WATCH" | "CONNECTED";

const STYLE: Record<ChipWord, string> = {
  "NO WATCH": "border-line text-graphite",
  CONNECTED: "border-ink text-ink",
  SENDING: "border-line text-graphite",
  WAITING: "border-spot text-spot before:size-1.5 before:bg-spot before:content-['']",
  SIGNED: "border-ink text-ink",
  CONFIRMED: "border-ink bg-ink text-paper",
  REJECTED: "border-spot bg-spot text-paper",
  EXPIRED: "border-spot bg-spot text-paper",
  LOCKED: "border-spot bg-spot text-paper",
  FAILED: "border-spot bg-spot text-paper",
};

export function StatusChip({ word, className }: { word: ChipWord; className?: string }) {
  return (
    <span
      data-chip={word}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-sk border px-2 font-mono text-12 font-medium tracking-caps whitespace-nowrap transition-colors duration-(--sk-dur-state)",
        STYLE[word],
        className,
      )}
    >
      {word}
    </span>
  );
}
