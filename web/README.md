This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Quality Gates

This project enforces strict quality gates in CI to prevent production incidents:

### CI Checks (Required on PR + Push to Main)

1. **ESLint** - Code quality and best practices
   - Run locally: `npm run lint`
   - Catches React/Next.js App Router footguns
   - TypeScript strict rules (no explicit `any`, unused vars)
   - Accessibility rules (jsx-a11y)

2. **Build** - Ensures the app compiles successfully
   - Run locally: `npm run build`
   - Fast-fail check before running slower tests
   - Catches TypeScript errors and build-time issues

3. **Git Conflict Markers** - Scans for unresolved merge conflicts
   - Prevents `<<<<<<<`, `=======`, `>>>>>>>` from reaching main
   - Scans all source files in `web/` (excluding node_modules, .next)

4. **useSearchParams + Suspense** - Validates proper Next.js App Router patterns
   - Client components using `useSearchParams()` must be wrapped in `<Suspense>` boundaries
   - Prevents entire pages from becoming client-rendered
   - Prevents runtime crashes from missing Suspense boundaries
   - **Pattern:**
     ```tsx
     // page.tsx (Server Component)
     import { Suspense } from "react"
     import { ClientComponent } from "@/components/client-component"
     
     export default function Page() {
       return (
         <Suspense fallback={<div>Loading...</div>}>
           <ClientComponent />
         </Suspense>
       )
     }
     
     // client-component.tsx (Client Component)
     "use client"
     import { useSearchParams } from "next/navigation"
     
     export function ClientComponent() {
       const searchParams = useSearchParams()
       // ... component logic
     }
     ```

5. **E2E Tests** - Playwright tests covering all routes
   - Run locally: `npm run test:e2e`
   - Desktop and mobile viewports
   - Accessibility testing (WCAG 2.0/2.1 Level A & AA)
   - Only runs after all other checks pass

### Why These Gates?

These checks prevent two classes of incidents that reached production:

1. **Git conflict markers merged to main** - Broke Vercel deployments
   - Now caught by conflict marker scanner before merge

2. **useSearchParams without Suspense** - Client-side crashes in production
   - Now caught by Suspense validation check before merge
   - All Scout pages now properly wrap client components in Suspense

### Running Checks Locally

```bash
# Run all checks (recommended before pushing)
npm run lint
npm run build
npm run test:e2e

# Or run individual checks
npm run lint         # ESLint
npm run build        # TypeScript + Next.js build
npm run test:e2e:ui  # E2E tests with UI (interactive)
```

## Environment template

Create a `.env.local` file in this `web/` folder if you need to override defaults.

Most features work without environment variables in development. For production deployment or specific configurations, you may need:

```
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Supabase (optional — app falls back to live Fantrax projections if not configured)
# Required for frozen weekly projection snapshots
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Supabase Setup

The app uses Supabase to store frozen Fantrax weekly projections. This allows Form charts to show "projected vs actual" even after Fantrax overwrites projections with live scores.

**Without Supabase:** The app still works — it just shows live Fantrax projections, which collapse to scored points once fixtures finish.

**With Supabase:**
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the migration: `supabase/migrations/20260828000000_create_projection_snapshots.sql`
3. Add environment variables to `.env.local`:
   - `SUPABASE_URL`: Your project URL (e.g. `https://abc123.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key (found in Project Settings → API)
4. Capture snapshots before each gameweek deadline:
   ```bash
   curl -X POST http://localhost:3000/api/fantrax/capture \
     -H "Content-Type: application/json" \
     -d '{"leagueId":"8rnibtdamsxcq60v","period":1}'
   ```

**First-snapshot-wins:** The capture endpoint will NOT overwrite existing snapshots for a given (league, period, player). Capture early (before fixtures start) for accurate projections.

## Testing

### E2E Testing with Playwright

The app includes comprehensive end-to-end tests covering:
- ✅ All key routes (Home, Form, Predicted, Rankings, Compare, Scout, Scout/Matchup, Scout/Waivers)
- ✅ **Smoke tests**: Critical routes load without "Application error" crashes
- ✅ **Scout Suspense**: Team picker and opportunity board render after Suspense resolves
- ✅ **Scout empty state**: Protected player / drop ban messaging with near-miss examples
- ✅ Desktop and mobile viewports (iPhone 12 Pro: 390x844)
- ✅ Accessibility testing (WCAG 2.0/2.1 Level A & AA)
- ✅ No horizontal overflow on mobile
- ✅ Mocked API routes for CI (no secrets required)

### Running Tests Locally

```bash
# Install dependencies (if not already done)
npm install

# Run all e2e tests
npm run test:e2e

# Run tests with UI mode (interactive)
npm run test:e2e:ui

# Run tests in debug mode (step through)
npm run test:e2e:debug

# Run specific test file
npx playwright test e2e/home.spec.ts

# Run tests on specific device
npx playwright test --project="Mobile Safari"
```

### Test Structure

```
web/
├── e2e/
│   ├── fixtures/           # Mock API response data
│   │   ├── fantrax-league.json
│   │   ├── fantrax-form.json
│   │   ├── scout-opportunities.json
│   │   ├── scout-opportunities-empty.json
│   │   └── scout-teams.json
│   ├── helpers/            # Test utilities
│   │   ├── accessibility.ts
│   │   └── api-mocks.ts
│   ├── smoke.spec.ts       # Critical smoke tests (no black-screen crashes)
│   ├── scout.spec.ts       # Scout opportunity board tests
│   ├── scout-matchup.spec.ts   # Scout matchup prep tests
│   ├── scout-waivers.spec.ts   # Scout waivers tests
│   ├── home.spec.ts        # Home page tests
│   ├── form.spec.ts        # Form page tests
│   ├── predicted.spec.ts   # Predicted XI tests
│   ├── rankings.spec.ts    # Rankings tests
│   └── compare.spec.ts     # Compare tests
└── playwright.config.ts    # Playwright configuration
```

### CI/CD

Tests run automatically on:
- Pull requests
- Push to `main` branch

The GitHub Actions workflow:
1. Installs dependencies and caches them
2. Builds the Next.js app (`npm run build`)
3. Starts the production server (`npm run start`)
4. Runs Playwright tests against the local server
5. Uploads test reports and traces on failure

**No environment variables required** — API routes are mocked with fixtures, so tests work without Fantrax or Supabase credentials.

### Accessibility Testing

All pages are tested for WCAG 2.0/2.1 Level A & AA compliance using [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright).

Critical and serious violations fail the test suite. This ensures:
- Proper heading hierarchy
- Accessible navigation and landmarks
- Color contrast compliance
- Keyboard navigation support
- Screen reader compatibility

### Mobile Testing

All routes are tested on mobile viewport (390x844 - iPhone 12 Pro) to ensure:
- No horizontal overflow
- Usable navigation
- Touch-friendly interactive elements
- Responsive layout

