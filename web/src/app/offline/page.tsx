import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Offline | Over the Moon",
  description: "You're currently offline",
}

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="space-y-2">
          <h1 className="text-4xl font-display font-bold text-foreground">
            You&apos;re Offline
          </h1>
          <p className="text-muted-foreground text-lg">
            No internet connection detected. Some features may be unavailable.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Over the Moon requires an internet connection to fetch live Fantasy Premier League data from Fantrax.
          </p>
          
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              Try Again
            </Link>
          </div>
        </div>

        <div className="pt-6 text-xs text-muted-foreground">
          <p>Check your connection and try refreshing the page.</p>
        </div>
      </div>
    </div>
  )
}
