import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 items-center rounded-sm border border-ink p-0.5 transition-colors duration-(--sk-dur-state) disabled:cursor-not-allowed disabled:opacity-(--sk-disabled-opacity) data-[state=checked]:bg-ink data-[state=unchecked]:bg-paper",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-sm transition-transform duration-(--sk-dur-state) data-[state=checked]:translate-x-5 data-[state=checked]:bg-paper data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-ink"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
