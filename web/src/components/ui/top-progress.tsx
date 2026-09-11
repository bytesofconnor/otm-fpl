// Description: Quiet route hairline. Not a live-green event.
"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

export function TopProgress(): React.ReactElement {
  const pathname = usePathname()
  const first = React.useRef(true)
  const [active, setActive] = React.useState(false)
  const [width, setWidth] = React.useState(0)

  React.useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setActive(true)
    setWidth(12)
    const tick = window.setInterval(() => {
      setWidth((w) => (w < 78 ? w + Math.max(1, Math.round((78 - w) * 0.12)) : w))
    }, 90)
    const done = window.setTimeout(() => {
      setWidth(100)
      window.setTimeout(() => {
        setActive(false)
        setWidth(0)
      }, 180)
    }, 420)
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(done)
    }
  }, [pathname])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[999]">
      <div
        className="h-px bg-foreground/50 transition-[width,opacity] duration-150"
        style={{ width: `${width}%`, opacity: active ? 1 : 0 }}
      />
    </div>
  )
}
