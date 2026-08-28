// Description: Site footer with legal links and safe-area padding.
import Link from "next/link"
import type { ReactElement } from "react"
import { BrandLockup } from "@/components/brand"
import { pageWidth } from "@/components/page-shell"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export function Footer(): ReactElement {
  return (
    <footer className="pb-[env(safe-area-inset-bottom)]">
      <Separator />
      <div className={`${pageWidth} flex flex-col gap-4 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between`}>
        <BrandLockup />
        <nav className="flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Footer">
          <Button variant="link" size="sm" nativeButton={false} className="h-11 px-2 text-muted-foreground" render={<Link href="/" />}>
            League
          </Button>
          <Button variant="link" size="sm" nativeButton={false} className="h-11 px-2 text-muted-foreground" render={<Link href="/form" />}>
            Form
          </Button>
          <Button variant="link" size="sm" nativeButton={false} className="h-11 px-2 text-muted-foreground" render={<Link href="/terms" />}>
            Terms
          </Button>
          <Button variant="link" size="sm" nativeButton={false} className="h-11 px-2 text-muted-foreground" render={<Link href="/privacy" />}>
            Privacy
          </Button>
        </nav>
      </div>
    </footer>
  )
}
