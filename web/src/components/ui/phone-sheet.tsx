"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export function PhoneSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="otm-scrim fixed inset-0 z-[60]" />
        <DialogPrimitive.Popup
          className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[min(70dvh,32rem)] flex-col overflow-hidden rounded-t-2xl border border-border bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] text-card-foreground shadow-[var(--shadow-lg)] outline-none"
        >
          <div className="flex items-center justify-between gap-2 px-4 pt-2">
            <DialogPrimitive.Title className="min-w-0 flex-1 whitespace-normal break-words text-[15px] font-semibold">
              {title}
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="tap flex size-11 shrink-0 items-center justify-center text-muted-foreground"
              aria-label="Close"
            >
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">{children}</div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function PickerOption({
  selected,
  onClick,
  children,
}: {
  selected?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex min-h-11 w-full items-start gap-2 rounded-md px-3 py-2 text-left text-[15px] whitespace-normal break-words",
        selected ? "bg-muted text-foreground" : "hover:bg-muted/70",
      )}
    >
      {children}
    </button>
  )
}
