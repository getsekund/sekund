import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-sk font-sans font-semibold whitespace-nowrap select-none transition-[translate,box-shadow] duration-(--sk-dur-press) ease-(--sk-ease-out) enabled:hover:underline enabled:hover:underline-offset-4 [a&]:hover:underline [a&]:hover:underline-offset-4 disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "border-2 border-ink bg-ink text-paper shadow-key enabled:active:translate-y-[2px] enabled:active:shadow-none",
        secondary: "border-2 border-ink bg-paper text-ink shadow-key enabled:active:translate-y-[2px] enabled:active:shadow-none",
        small: "border border-ink bg-paper text-ink aria-pressed:bg-ink aria-pressed:text-paper",
        destructive: "border-2 border-spot bg-spot text-paper shadow-key enabled:active:translate-y-[2px] enabled:active:shadow-none",
      },
      size: {
        default: "h-(--sk-control-h) px-[18px] text-[15px]",
        sm: "h-(--sk-control-h-sm) px-2.5 text-[13px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  const resolvedSize = size ?? (variant === "small" ? "sm" : "default")

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={resolvedSize}
      className={cn(buttonVariants({ variant, size: resolvedSize, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
