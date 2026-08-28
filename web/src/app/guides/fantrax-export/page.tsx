// Description: SEO guide – How to export OTM rankings to Fantrax (2025/26)
import type { Metadata } from "next"
import Link from "next/link"
import { PageShell } from "@/components/page-shell"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "How to export OTM FPL Draftkit rankings to Fantrax (2025/26)",
  description:
    "Step‑by‑step guide to exporting your OTM FPL Draftkit board to Fantrax for the 2025/26 season – CSV format, import steps, and tips.",
  alternates: { canonical: "/guides/fantrax-export" },
}

export default function FantraxExportGuide() {
  return (
    <PageShell width="article">
      <p className="otm-kicker">Guide</p>
      <h1 className="otm-title mt-2 text-3xl sm:text-[2.15rem]">Export OTM rankings to Fantrax</h1>
      <div className="otm-prose mt-8">
        <p>
          OTM exports a CSV that Fantrax accepts out of the box. Follow these steps on draft day.
        </p>
        <ol>
          <li>
            From{" "}
            <Button variant="link" nativeButton={false} className="h-auto p-0" render={<Link href="/rankings" />}>
              Rankings
            </Button>
            , click <strong>Export CSV</strong>.
          </li>
          <li>In Fantrax, open <strong>Rankings → Import Rankings</strong>.</li>
          <li>
            Upload the CSV. Each row is <code>First Last,TEAM</code>.
          </li>
          <li>Confirm and save. Your draft board updates instantly.</li>
        </ol>
        <h3>Tips</h3>
        <ul>
          <li>Use OTM on mobile during the draft — the UI is tuned for quick comparisons.</li>
          <li>Share/Sync your board between devices from the Rankings page.</li>
          <li>
            Predicted XIs and highlights live on{" "}
            <Button variant="link" nativeButton={false} className="h-auto p-0" render={<Link href="/compare" />}>
              Compare
            </Button>
            .
          </li>
        </ul>
      </div>
    </PageShell>
  )
}
