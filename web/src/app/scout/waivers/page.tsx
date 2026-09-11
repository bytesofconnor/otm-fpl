import type { Metadata } from "next"
import { Suspense } from "react"
import { WaiverBoard } from "@/components/scout-waiver-board"
import { ScoutTeamPicker } from "@/components/scout-team-picker"
import { ScoutSubnav } from "@/components/scout-subnav"
import { PageShell } from "@/components/page-shell"
import { OtmLoader } from "@/components/otm-loader"

export const metadata: Metadata = {
  title: "Scout · Waivers",
  description: "Waiver claims for the connected Fantrax league.",
}

export default async function ScoutWaiversPage({
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
          <ScoutSubnav room="Waivers" />
        </Suspense>

        <Suspense fallback={null}>
          <ScoutTeamPicker currentTeamId={teamId} basePath="/scout/waivers" />
        </Suspense>

        <Suspense fallback={<WaiverFallback />}>
          <WaiverBoard />
        </Suspense>
      </div>
    </PageShell>
  )
}

function WaiverFallback() {
  return <OtmLoader className="min-h-[40vh] py-8" label="Waivers" hint="Loading claim order" />
}
