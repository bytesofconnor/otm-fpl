// Description: Light-weight Terms of Service for Over the Moon.
import { PageShell } from "@/components/page-shell"

export default function TermsPage() {
  return (
    <PageShell width="article">
      <p className="otm-kicker">Legal</p>
      <h1 className="otm-title mt-2 text-3xl sm:text-[2.15rem]">Terms</h1>
      <div className="otm-prose mt-8">
        <p>
          Welcome to <strong>Over the Moon</strong>. By using the companion you agree to these terms.
        </p>

        <h3>1. Overview</h3>
        <p>
          Over the Moon is a Fantrax companion for our league. It is not affiliated with the Premier League, official FPL, or Fantrax. You are responsible for how you use it.
        </p>

        <h3>2. Access</h3>
        <p>
          Over the Moon is free to use. No accounts or payments are required.
        </p>

        <h3>3. License</h3>
        <p>
          You receive a personal, non-transferable license. Do not copy, resell, or scrape the service.
        </p>

        <h3>4. Data</h3>
        <p>
          The companion reads public Fantrax league data and your local choices. We do not guarantee accuracy or uptime.
        </p>

        <h3>5. No warranties</h3>
        <p>
          The service is provided as is. Your use is at your own risk.
        </p>
      </div>
    </PageShell>
  )
}
