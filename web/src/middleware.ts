import { NextResponse, type NextRequest } from "next/server"

/**
 * Simplified middleware for single-user app.
 * No auth checks to avoid blocking page loads (fixes timeout issues from PR #73).
 */
export async function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
