// Scout Opportunity Board — SIA-first pickup intelligence
import type { Metadata } from "next"
import { OpportunityBoard } from "@/components/scout-opportunity-board"
import { PageShell } from "@/components/page-shell"

export const metadata: Metadata = {
  title: "Scout · Opportunity Board",
  description: "Pickup intelligence for Over the Moon. See hot wire opportunities ranked by form.",
}

export default function ScoutPage() {
  return (
    <PageShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Scout
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pickup opportunities ranked by form. SIA-first intelligence.
          </p>
        </header>

        <OpportunityBoard />
      </div>
    </PageShell>
  )
}
