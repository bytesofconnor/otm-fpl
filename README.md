# Over the Moon

**Live Fantrax companion for the Over the Moon FPL draft league.**

Monorepo root with web app in `web/`.

## What is Over the Moon?

Over the Moon is a Next.js web app that provides live league standings, head-to-head matchup details, and player form analysis for the Over the Moon FPL draft league hosted on Fantrax.

### Features

- **League (This Week HQ)**: Current gameweek standings, live scoring, and head-to-head matchup results
- **Form**: Player performance analysis comparing scored points vs leftover (bench) points to identify waiver wire opportunities
- **Rankings** (optional): Personal player ranking tool with shareable links
- **Compare** (optional): Side-by-side player comparison tool
- **Predicted** (optional): Pre-season player projections

The product focuses on League and Form as the core features. Rankings, Compare, and Predicted remain as helpful tools but are not the main value proposition.

## Development

- Local dev: `cd web && npm ci && npm run dev`
- Production build: `cd web && npm run build && npm start -p 3000`

## Deployment (Vercel)

- Set Root Directory to `web/` or use `vercel.json` provided
- Install Command: `cd web && npm ci`
- Build Command: `cd web && npm run build`
- Output: `.next`

## Environment Variables

See `web/README.md` for environment setup details.

## Data Sources

The app pulls live league data from Fantrax. It does not replicate Fantrax functionality—it enhances the league experience with focused views on this week's action and player form trends.
