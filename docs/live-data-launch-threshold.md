# Live Data Launch Threshold

The `Live` badge must stay disabled until the retailer data pipeline proves it is reliable. Before that point, the app should label prices as `Recently observed prices` and offers as `Catalogue offers`.

## Required Gates

All of the following must pass before enabling `Live prices`:

1. At least two retailers have successful scheduled extraction.
2. Each launch retailer has freshness timestamps, promotion expiry dates, source provenance, and monitoring coverage.
3. Each launch retailer completes a seven-day reliability run.
4. Scraper status reports show no unresolved blocked-source fallback, sharp extraction drop, or stale-data alert.
5. The operator status page shows healthy or watch status for launch retailers, never unverified.

The readiness helper in `scripts/src/retailers/launch-readiness.ts` returns `Recently observed prices` until at least two retailers satisfy the full gate.
