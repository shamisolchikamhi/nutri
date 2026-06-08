# NutriBasket

NutriBasket helps people hit nutrition and body goals with meal tracking, goal-aware recipes, and market-aware grocery baskets that reflect real retailer prices, availability, and specials.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run scrape:open-food-facts -- --market=ZA --limit=80` — fetch a real product/nutrition fixture without writing to the DB
- `pnpm --filter @workspace/scripts run scrape:open-food-facts -- --market=ZA --limit=80 --write` — seed scraped product/nutrition data into the DB
- `pnpm --filter @workspace/scripts run scrape:open-food-facts -- --market=ZA --from=scripts/out/open-food-facts-ZA.json --write` — seed from a cached scrape fixture
- Required env: `DATABASE_URL` — Postgres connection string
- Optional env: `OPENAI_API_KEY` — enables URL-only AI extraction for social recipes
- Optional env: `OPENAI_MODEL` — overrides the social recipe extraction model; defaults to `gpt-4o-mini`

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
- Social recipe import: paste public TikTok, Instagram, or Facebook recipe links, let AI extract available recipe details when public text is accessible, store creator/source attribution, match ingredients to local-market products, and create baskets from matched items.
- Multi-retailer product layer: normalize products across stores, compare pack sizes, prices, nutrition labels, availability, and specials.

## Market Model

- Treat market, currency, locale, retailers, nutrition-label conventions, measurement defaults, and product ingestion rules as market-specific configuration.
- Do not hardcode a single country, currency symbol, or retailer set in user-facing copy. Use market-aware formatting/config for display and market-scoped retailer data for catalog behavior.
- Current frontend display defaults live in `artifacts/nutrition-app/src/lib/market.ts`. The active market can be driven by `VITE_DEFAULT_MARKET` or local storage.
- Retailers carry a `marketCode` so product and specials integrations can be scoped by market over time.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Open Food Facts provides real product/nutrition metadata but not retailer shelf prices; the first scraper uses deterministic test prices until retailer-specific price feeds/scrapers are connected.
- Social recipe import adds `social_recipe_sources`; run the DB push before testing it against a fresh database.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
