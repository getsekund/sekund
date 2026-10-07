import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function InlineError({ cause, children, action, className }: { cause: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("space-y-3 border-l-2 border-spot py-0.5 pl-2.5 text-14 leading-snug text-spot", className)}>
      <p>
        <strong className="font-semibold">{cause}</strong> {children}
      </p>
      {action}
    </div>
  );
}
