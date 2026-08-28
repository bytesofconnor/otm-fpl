// Description: Light-weight Privacy Policy for Over the Moon.
import { PageShell } from "@/components/page-shell"

export default function PrivacyPage() {
  return (
    <PageShell width="article">
      <p className="otm-kicker">Legal</p>
      <h1 className="otm-title mt-2 text-3xl sm:text-[2.15rem]">Privacy</h1>
      <div className="otm-prose mt-8">
        <h3>Overview</h3>
        <p>
          We collect as little personal data as possible to run Over the Moon.
        </p>

        <h3>What we store</h3>
        <ul>
          <li><strong>Local data</strong>: League and team choice, and any license status, live in your browser.</li>
          <li><strong>Server logs</strong>: Basic request logs from the host for security and troubleshooting.</li>
          <li><strong>Payments</strong>: Handled by Stripe. We do not store card numbers.</li>
        </ul>

        <h3>How we use information</h3>
        <ul>
          <li>Operate and improve the companion.</li>
          <li>Prevent abuse.</li>
          <li>Reply if you contact us.</li>
        </ul>

        <h3>Cookies</h3>
        <p>
          We use cookies and local storage to remember your league, team, and license. Clearing site data removes them from this device.
        </p>

        <h3>Data sharing</h3>
        <p>
          We do not sell personal data. Payment processing may receive what Stripe needs to complete a purchase.
        </p>

        <h3>Your choices</h3>
        <ul>
          <li>Clear local data in the browser at any time.</li>
          <li>Use a license token to restore paid features on a new device.</li>
        </ul>
      </div>
    </PageShell>
  )
}
