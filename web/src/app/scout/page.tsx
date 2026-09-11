import type { Metadata } from "next"
import { Suspense } from "react"
import { OpportunityBoard } from "@/components/scout-opportunity-board"
import { ScoutTeamPicker } from "@/components/scout-team-picker"
import { ScoutSubnav } from "@/components/scout-subnav"
import { PageShell } from "@/components/page-shell"
import { OtmLoader } from "@/components/otm-loader"

export const metadata: Metadata = {
  title: "Scout · Wire",
  description: "Wire claims for the connected Fantrax league, ranked by form.",
}

export default async function ScoutPage({
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
          <ScoutSubnav room="Wire" />
        </Suspense>

        <Suspense fallback={null}>
          <ScoutTeamPicker currentTeamId={teamId} basePath="/scout" />
        </Suspense>

        <Suspense fallback={<BoardFallback />}>
          <OpportunityBoard />
        </Suspense>
      </div>
    </PageShell>
  )
}

function BoardFallback() {
  return <OtmLoader className="min-h-[40vh] py-8" label="Scout" hint="Ranking the wire" />
}
