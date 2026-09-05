import type { Metadata, Viewport } from "next"
import { Barlow_Condensed, Barlow_Semi_Condensed, IBM_Plex_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import "./globals.css"
import { AppHeader } from "@/components/app-header"
import { Footer } from "@/components/footer"
import { TopProgress } from "@/components/ui/top-progress"
import { TooltipProvider } from "@/components/ui/tooltip"
import { LeagueStatusProvider } from "@/components/league-status"
import { IOSInstallPrompt } from "@/components/ios-install-prompt"

const sans = Barlow_Semi_Condensed({
  variable: "--font-sans-otm",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const display = Barlow_Condensed({
  variable: "--font-display-otm",
  subsets: ["latin"],
  weight: ["600", "700"],
})

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono-otm",
  subsets: ["latin"],
  weight: ["400", "500"],
})

export const viewport: Viewport = {
  themeColor: "#0a120e",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  title: "Over the Moon",
  description:
    "Live Fantrax companion for Over the Moon FPL: this week’s matchup, standings, form, and the wire.",
  keywords: [
    "FPL",
    "Fantasy Premier League",
    "FPL Draft",
    "Premier League draft tool",
    "Fantrax",
  ],
  metadataBase: new URL("https://fpldraftkit.com"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Over the Moon",
    description: "Live Fantrax companion for Over the Moon FPL.",
    url: "https://fpldraftkit.com",
    siteName: "Over the Moon",
    images: [{ url: "/favicon.svg", width: 512, height: 512 }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Over the Moon",
    description: "Live Fantrax companion for Over the Moon FPL.",
    images: ["/favicon.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OTM FPL",
  },
  applicationName: "Over the Moon",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* PWA & iOS-specific meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="OTM FPL" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className={`${sans.variable} ${display.variable} ${plexMono.variable} antialiased bg-background text-foreground`}>
        <div className="otm-stadium" aria-hidden />
        <LeagueStatusProvider>
          <TooltipProvider>
          <TopProgress />
          <script
            dangerouslySetInnerHTML={{
              __html: `
          (function(){
            try { fetch('/api/app-bundle', { cache: 'force-cache' }); } catch(e) {}
          })();
        `,
            }}
          />
          <div className="relative z-10 min-h-screen flex flex-col">
            <AppHeader />
            <main id="main-content" className="flex-1">{children}</main>
            <Footer />
          </div>
          <IOSInstallPrompt />
          <Analytics />
          <SpeedInsights />
          </TooltipProvider>
        </LeagueStatusProvider>
      </body>
    </html>
  )
}
