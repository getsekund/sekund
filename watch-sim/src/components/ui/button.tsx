import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/* DESIGN.md §7 buttons: radius 2, Archivo 600 at 15, keycap shadow, 2 px press, underline on hover. */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-sm font-semibold whitespace-nowrap text-(length:--sk-button-text) transition-[transform,box-shadow] duration-(--sk-dur-press) ease-(--sk-ease-out) hover:underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-(--sk-disabled-opacity) aria-disabled:cursor-not-allowed aria-disabled:opacity-(--sk-disabled-opacity) [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-2 border-ink bg-ink text-paper shadow-key active:translate-y-0.5 active:shadow-none",
        secondary: "border-2 border-ink bg-paper text-ink shadow-key active:translate-y-0.5 active:shadow-none",
        small: "border border-ink bg-paper text-ink",
        destructive: "border-2 border-spot bg-spot text-paper shadow-key active:translate-y-0.5 active:shadow-none",
      },
      size: {
        default: "h-(--sk-control-h) px-4",
        sm: "h-(--sk-control-h-sm) px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
