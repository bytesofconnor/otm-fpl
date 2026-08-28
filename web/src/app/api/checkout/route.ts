// Description: Creates a Stripe Checkout Session for one-time purchase
import { NextResponse } from 'next/server'

// Simple in-memory rate limiter per IP (best-effort in serverless)
const rl = new Map<string, { n: number; t: number }>()
function rateLimit(ip: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now()
  const cur = rl.get(ip)
  if (!cur || now - cur.t > windowMs) { rl.set(ip, { n: 1, t: now }); return true }
  if (cur.n >= limit) return false
  cur.n += 1
  return true
}

function getHost(headers: Headers): string {
  return headers.get('x-forwarded-host') || headers.get('host') || ''
}

export async function POST(request: Request) {
  try {
    // Basic rate limit
    const ip = request.headers.get('x-forwarded-for') || 'local'
    if (!rateLimit(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const secretKey = process.env.STRIPE_SECRET_KEY
    const priceId = process.env.STRIPE_PRICE_ID
    const hasSecret = Boolean(secretKey)
    const hasPrice = Boolean(priceId)
    if (!hasSecret || !hasPrice) {
      console.error('[checkout] missing config', { hasSecret, hasPrice })
      return NextResponse.json({ error: 'stripe_config', hasSecret, hasPrice }, { status: 500 })
    }
    // defer import to keep cold-start smaller
    const stripeMod = await import('stripe')
    const stripe = new stripeMod.default(secretKey as string, { apiVersion: '2023-10-16' })

    // derive base URL
    const headers = new Headers(request.headers)
    const host = getHost(headers)
    const proto = headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    const rawBase = process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`
    // ensure scheme is present and strip trailing slash
    const baseUrl = (/^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`).replace(/\/$/, '')
    console.log('[checkout] baseUrl', { baseUrl, host, proto })

    // Enforce allowed host if set
    const allowedHost = process.env.NEXT_PUBLIC_PAID_HOST
    const okHost = (() => {
      if (!allowedHost) return true
      const list = allowedHost.split(',').map((s) => s.trim()).filter(Boolean)
      const hosts = new Set<string>()
      for (const h of list) { hosts.add(h); hosts.add(h.replace(/^www\./,'')); hosts.add(h.startsWith('www.')? h.slice(4) : `www.${h}`) }
      return hosts.has(host) || Array.from(hosts).some((h) => host.startsWith(`${h}:`))
    })()
    if (!okHost) {
      console.error('[checkout] invalid_host', { host, allowedHost })
      return NextResponse.json({ error: 'invalid_host', host, allowedHost }, { status: 403 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/`,
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const msg = (err as { message?: string })?.message || 'Failed to create session'
    console.error('[checkout] create_failed', { message: msg })
    const body = process.env.NODE_ENV === 'production'
      ? { error: 'create_failed' }
      : { error: 'create_failed', message: msg }
    return NextResponse.json(body, { status: 500 })
  }
}


