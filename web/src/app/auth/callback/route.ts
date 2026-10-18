import { NextResponse } from "next/server"

/**
 * Simplified auth callback for single-user app (no auth provider).
 * Kept for backward compatibility in case old magic links exist.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  return NextResponse.redirect(new URL("/", url.origin))
}
