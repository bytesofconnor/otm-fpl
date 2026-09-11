import type { Metadata } from "next"
import { Suspense } from "react"
import { MatchupPrep } from "@/components/scout-matchup-prep"
import { ScoutTeamPicker } from "@/components/scout-team-picker"
import { ScoutSubnav } from "@/components/scout-subnav"
import { PageShell } from "@/components/page-shell"
import { OtmLoader } from "@/components/otm-loader"

export const metadata: Metadata = {
  title: "Scout · Matchup",
  description: "Start and sit for the connected Fantrax league.",
}

export default async function MatchupPrepPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>
}) {
  const params = await searchParams
  const teamId = params.teamId ?? null

  return (
    <PageShell>
      <div className="space-y-5">
        <Suspense fallback={null}>
          <ScoutSubnav room="Matchup" />
        </Suspense>

        <Suspense fallback={null}>
          <ScoutTeamPicker currentTeamId={teamId} basePath="/scout/matchup" />
        </Suspense>

        <Suspense fallback={<MatchupFallback />}>
          <MatchupPrep />
        </Suspense>
      </div>
    </PageShell>
  )
}

function MatchupFallback() {
  return <OtmLoader className="min-h-[40vh] py-8" label="Matchup" hint="Loading start and sit" />
}
