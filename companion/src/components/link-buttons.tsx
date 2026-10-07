import { useEffect, useState } from "react";
import { ArrowUpRightIcon, CopyIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <Button
      variant="small"
      aria-label={label}
      title={value}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
      }}
    >
      <CopyIcon /> {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function ExplorerButton({ href }: { href: string }) {
  return (
    <Button asChild variant="small">
      <a href={href} target="_blank" rel="noopener" data-testid="explorer-link">
        Explorer <ArrowUpRightIcon />
      </a>
    </Button>
  );
}
