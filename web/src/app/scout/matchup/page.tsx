// Scout Matchup Prep — Start/sit intelligence
import type { Metadata } from "next"
import { MatchupPrep } from "@/components/scout-matchup-prep"
import { PageShell } from "@/components/page-shell"

export const metadata: Metadata = {
  title: "Scout · Matchup Prep",
  description: "Start/sit decisions for Over the Moon. Lineup heatmap and bench order.",
}

export default function MatchupPrepPage() {
  return (
    <PageShell>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Matchup Prep
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Start/sit intelligence. Lineup heatmap and bench order.
          </p>
        </header>

        <MatchupPrep />
      </div>
    </PageShell>
  )
}
