import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/* DESIGN.md §7 status chips: Plex Mono 500 at 12, caps, words that match the watch. */
const badgeVariants = cva(
  "inline-flex h-(--sk-chip-h) w-fit shrink-0 items-center gap-1.5 rounded-sm border px-2 font-mono text-xs font-medium tracking-(--sk-tracking-caps) whitespace-nowrap uppercase transition-colors duration-(--sk-dur-state)",
  {
    variants: {
      variant: {
        idle: "border-line text-graphite",
        ink: "border-ink text-ink",
        filled: "border-ink bg-ink text-paper",
        waiting: "border-spot text-spot before:size-(--sk-chip-mark) before:bg-spot before:content-['']",
        stop: "border-spot bg-spot text-paper",
      },
    },
    defaultVariants: {
      variant: "idle",
    },
  }
)

function Badge({
  className,
  variant = "idle",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
