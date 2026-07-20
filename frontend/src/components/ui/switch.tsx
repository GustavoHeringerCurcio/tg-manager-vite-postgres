"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full outline-none transition-colors duration-200",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "data-unchecked:bg-neutral-200 dark:data-unchecked:bg-neutral-600 data-unchecked:ring-1 data-unchecked:ring-border",
        "data-checked:bg-primary data-checked:ring-1 data-checked:ring-primary/30",
        "data-[size=default]:h-[22px] data-[size=default]:w-[42px]",
        "data-[size=sm]:h-[16px] data-[size=sm]:w-[30px]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-sm ring-1 ring-black/[0.06] transition-transform duration-200 ease-out",
          "dark:bg-white",
          "group-data-[size=default]/switch:size-[18px]",
          "group-data-[size=default]/switch:data-unchecked:translate-x-[2px]",
          "group-data-[size=default]/switch:data-checked:translate-x-[20px]",
          "group-data-[size=sm]/switch:size-[12px]",
          "group-data-[size=sm]/switch:data-unchecked:translate-x-[2px]",
          "group-data-[size=sm]/switch:data-checked:translate-x-[14px]",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
