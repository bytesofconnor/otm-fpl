// Description: Lightweight top progress indicator triggered on route/path changes.
"use client"

import * as React from 'react'
import { usePathname } from 'next/navigation'

export function TopProgress(): React.ReactElement {
  const pathname = usePathname()
  const [active, setActive] = React.useState(false)
  const [width, setWidth] = React.useState(0)

  React.useEffect(() => {
    // Start progress when pathname changes (new page mounted)
    setActive(true)
    setWidth(8)
    const id = setInterval(() => {
      setWidth((w) => (w < 80 ? w + Math.max(1, Math.round((80 - w) * 0.1)) : w))
    }, 80)
    const done = setTimeout(() => {
      setWidth(100)
      setTimeout(() => { setActive(false); setWidth(0) }, 300)
    }, 600)
    return () => { clearInterval(id); clearTimeout(done) }
  }, [pathname])

  return (
    <div className="fixed inset-x-0 top-0 z-[999] pointer-events-none">
      <div
        className="h-[2px] bg-primary transition-all duration-150"
        style={{ width: `${width}%`, opacity: active ? 0.85 : 0 }}
      />
    </div>
  )
}


