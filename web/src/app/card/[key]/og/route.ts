import { paintScorebug, readScorebug } from "@/lib/scorebug"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params
  const broadcast = await readScorebug(key)
  const image = await paintScorebug(broadcast.bug)
  image.headers.set("cache-control", "public, s-maxage=120, stale-while-revalidate=300")
  return image
}
