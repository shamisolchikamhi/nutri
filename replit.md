# NutriBasket

NutriBasket helps people hit nutrition and body goals with meal tracking, goal-aware recipes, and market-aware grocery baskets that reflect real retailer prices, availability, and specials.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

- Multi-market nutrition and grocery planning: markets such as South Africa, Australia, the UK, and the US should be configuration, not hardcoded product behavior.
- User profile and goal setup: body stats, activity, diet preferences, budget, meal frequency, and retailer preferences.
- Goal engine: maintenance calories, calorie target, deficit, macros, weekly loss range, and timeline to goal.
- Meal/activity tracking: calories, macros, water, weight entries, dummy activity data, streaks, and weekly summaries.
- Recipe discovery and basket building: recommend recipes by goal, turn ingredients into deduplicated shopping baskets, calculate cost per serving, and compare basket modes.
- Multi-retailer product layer: normalize products across stores, compare pack sizes, prices, nutrition labels, availability, and specials.

## Market Model

- Treat market, currency, locale, retailers, nutrition-label conventions, measurement defaults, and product ingestion rules as market-specific configuration.
- Do not hardcode a single country, currency symbol, or retailer set in user-facing copy. Use market-aware formatting/config for display and market-scoped retailer data for catalog behavior.
- Current frontend display defaults live in `artifacts/nutrition-app/src/lib/market.ts`. The active market can be driven by `VITE_DEFAULT_MARKET` or local storage.
- Retailers carry a `marketCode` so product and specials integrations can be scoped by market over time.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
