import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-(--sk-control-h) w-full min-w-0 rounded-sk border border-line bg-paper px-3 text-16 text-ink placeholder:text-graphite disabled:cursor-not-allowed disabled:opacity-40",
        "aria-invalid:border-spot",
        className
      )}
      {...props}
    />
  )
}

export { Input }
