import type { Metadata } from "next"
import { cache } from "react"
import { PageShell } from "@/components/page-shell"
import { readScorebug, ScorebugPage } from "@/lib/scorebug"

export const dynamic = "force-dynamic"

const loadCard = cache((key: string) => readScorebug(key))

function cardImage(key: string) {
  return {
    url: `/card/${encodeURIComponent(key)}/og`,
    width: 1200,
    height: 630,
    type: "image/png" as const,
  }
}

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params
  const broadcast = await loadCard(key)
  const image = cardImage(key)
  const line = broadcast.bug.line
  return {
    title: line,
    description: line,
    openGraph: {
      title: line,
      description: line,
      siteName: "Over the Moon",
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: line,
      description: line,
      images: [image],
    },
  }
}

export default async function CardPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const broadcast = await loadCard(key)
  return (
    <PageShell width="article">
      <ScorebugPage broadcast={broadcast} />
    </PageShell>
  )
}
