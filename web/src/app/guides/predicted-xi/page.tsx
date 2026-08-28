// Description: SEO guide – Predicted GW1 XIs methodology (2025/26)
import type { Metadata } from "next"
import Link from "next/link"
import { PageShell } from "@/components/page-shell"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Predicted GW1 XIs – methodology (2025/26)",
  description:
    "How OTM FPL Draftkit surfaces predicted GW1 starting lineups for 2025/26 and how to read the mini‑formation.",
  alternates: { canonical: "/guides/predicted-xi" },
}

export default function PredictedXiGuide() {
  return (
    <PageShell width="article">
      <p className="otm-kicker">Guide</p>
      <h1 className="otm-title mt-2 text-3xl sm:text-[2.15rem]">Predicted GW1 XIs</h1>
      <div className="otm-prose mt-8">
        <p>
          OTM blends reputable lineup sources with manual curation to flag likely starters. When a player is tagged{" "}
          <strong>YES</strong>, you will see a mini-formation and role (e.g. <em>MID 1/5</em>). Use this as a quick
          tiebreaker in early rounds.
        </p>
        <p>
          View them live on{" "}
          <Button variant="link" nativeButton={false} className="h-auto p-0" render={<Link href="/compare" />}>
            Compare
          </Button>{" "}
          or the{" "}
          <Button variant="link" nativeButton={false} className="h-auto p-0" render={<Link href="/predicted" />}>
            Predicted XIs
          </Button>{" "}
          page.
        </p>
      </div>
    </PageShell>
  )
}
