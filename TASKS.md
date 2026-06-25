# NutriBasket Product Backlog

This backlog combines the end-user audit, code duplication review, and product
differentiation ideas. Complete work roughly in priority order; an AI layer
should not be shipped on top of unreliable health data or silent failures.

## P0 - Make the Core App Trustworthy

- [x] Distinguish loading, empty, and failed API states on every data screen.
  - Cover dashboard, tracker, history, activity, recipes, meal plan, baskets,
    products, specials, progress, saved items, and settings.
  - Include a plain-language message, retry action, and support/debug reference.
  - Never render failed requests as valid zero values or an empty catalogue.
- [x] Add shared mutation error handling for every write action.
  - Cover profile, settings, meals, water, activity, weight, saves, and baskets.
  - Preserve user input after failure and provide an explicit retry action.
  - Show success only after the server confirms persistence.
- [x] Add schema-based profile validation to onboarding and settings.
  - Require age, height, current weight, target weight, and valid ranges.
  - Do not replace missing health data with invented defaults.
  - Show field-level errors and block progression/submission until valid.
- [x] Fix dashboard fallback calculations.
  - Do not show `0 / 2000 kcal` together with `0` remaining.
  - Use server-provided targets; otherwise show an unavailable state.
- [x] Make startup fail clearly when the API is unavailable or misconfigured.
  - Add an API health check and configuration diagnostics.
  - Document local database/API setup and avoid silently proxying to another
    service occupying port 5000.
- [x] Restore cross-platform dependency installation.
  - Stop excluding the native macOS packages required by Rollup, Lightning CSS,
    and Tailwind on Apple Silicon.
  - Verify clean installs and startup on macOS and Linux in CI.

## P1 - Complete and Test User Journeys

- [x] Add automated end-to-end tests for onboarding through first dashboard load.
- [x] Add end-to-end tests for logging a meal, water, activity, and weight.
- [x] Add end-to-end tests for saving a recipe and creating its grocery basket.
- [x] Add end-to-end tests for product filters, specials, and basket comparison.
- [x] Add destructive-action confirmation and undo for deletes/removals.
- [x] Improve empty states with one relevant next action and prerequisite guidance.
- [x] Replace raw HTTP messages with user-focused errors and stable error codes.
- [x] Add accessible labels, validation announcements, and keyboard-flow tests.
- [x] Test mobile layouts at 320, 390, 768, and desktop widths.
- [x] Add seeded demo data so a new user can understand the value immediately.

## P1 - Remove Duplication and Redundancy

- [x] Extract one shared profile schema, form model, and serializer.
  - Reuse it in onboarding and settings.
  - Centralize diet-selection and retailer-selection helpers.
- [x] Create shared `PageState` components for loading, error, empty, and retry UI.
- [x] Create a standard mutation helper for success messages, errors, and query
  invalidation instead of repeating page-specific `useMutation` plumbing.
- [x] Centralize nutrition defaults and formatting.
  - Remove scattered `2000` kcal, `2500` ml, date locale, and fallback literals.
  - Derive goals from the profile or market configuration.
- [x] Extract shared recipe and product cards, image fallbacks, save controls, and
  basket actions used across dashboard, recipes, saved, products, and specials.
- [x] Move social-recipe media processing and import UI out of the 627-line
  recipes page into focused hooks/components.
- [x] Split oversized API route modules into services and route adapters.
  - Prioritize `social-recipes.ts` and `baskets.ts`.
- [x] Consolidate repeated server helpers.
  - One `parseId`/request-validation utility.
  - One recipe-schema migration path instead of repeated `ensureRecipesSchema`.
  - One ingredient normalization, quantity conversion, product matching, and
    basket-quantity service shared by baskets and social recipes.
- [x] Move schema creation out of request-time route code into database migrations.
- [x] Review navigation information architecture with users.
  - Combine Tracker, History, Activity, and Progress under a `Track` workspace.
  - Combine Products and Specials under a `Shop` workspace with filter tabs.
  - Treat Saved as a library section instead of another top-level destination.
  - Keep routes addressable even if the sidebar is simplified.

## P1 - Live Retailer Data and Promotions

- [x] Replace the generic retailer HTML parser with retailer-specific adapters.
  - Start with Pick n Pay catalogue pages and Checkers catalogue content.
  - Add a dedicated Woolworths adapter for its current product and promotion
    page structure.
  - Prefer permitted structured feeds or retailer APIs where available.
- [x] Add browser-rendered extraction for JavaScript-dependent retailer pages.
  - Respect retailer terms, robots directives, rate limits, and access controls.
  - Do not attempt to bypass retailer bot protection or authentication.
- [x] Add scraper contract tests using versioned HTML/catalogue fixtures.
  - Verify product name, pack size, price, promotion, dates, and retailer.
  - Fail the job when a previously healthy source unexpectedly extracts zero.
- [x] Separate retailer pricing from Open Food Facts nutrition records.
  - Use Open Food Facts for product identity and nutrition where reliable.
  - Never present generated test prices as observed retailer prices.
  - Add a reviewed product-matching process using barcode first and normalized
    brand/name/pack size as a fallback.
- [x] Extend retailer and product provenance fields.
  - Store retailer external ID, barcode, canonical source URL, region, store,
    channel, currency, first seen, last seen, scraped at, and last verified at.
  - Rename currency-specific database fields such as `priceAud` to neutral names.
- [x] Extend the promotions model.
  - Add `validFrom`, `validUntil`, promotion type, regular price, special price,
    multibuy quantity and price, percentage discount, loyalty requirement,
    stock status, region/store scope, terms, and source URL.
  - Support single-price, percentage, multibuy, bundle, and loyalty-card offers.
- [x] Build promotion ingestion and reconciliation.
  - Upsert promotions using stable retailer IDs and source identifiers.
  - Mark promotions stale when they disappear from a successful scrape.
  - Expire promotions automatically after `validUntil`.
  - Preserve price history instead of overwriting the only observed price.
- [x] Make the specials API return only currently valid promotions by default.
  - Filter using `validFrom <= now <= validUntil`.
  - Add explicit filters for expired, upcoming, region, store, channel, and
    loyalty-only promotions.
  - Avoid N+1 retailer/product queries when building promotion responses.
- [x] Make freshness and conditions visible in the app.
  - Display validity dates, participating region/store, channel, loyalty-card
    requirement, multibuy conditions, stock caveats, and source link.
  - Display `Verified X hours ago` on every price and promotion.
  - Never label data `Live` when it is stale, generated, or unverified.
- [x] Add data-quality gates before publishing scraped records.
  - Reject invalid prices, impossible savings, missing dates, mismatched currency,
    duplicate products, and ambiguous pack sizes.
  - Send uncertain product matches to a review queue.
- [x] Add scraper observability and operations.
  - Schedule retailer-specific jobs with conservative rate limits.
  - Track requests, extraction counts, changed prices, new/expired promotions,
    parse failures, blocked requests, and last successful run.
  - Alert when extraction drops sharply, a source is blocked, or data becomes stale.
- [x] Add a retailer-data status page for operators.
  - Show source health, last run, last successful extraction, current record count,
    stale records, blocked adapters, and recent parsing errors.
- [x] Define a lawful fallback for blocked sources.
  - Use retailer-approved feeds, affiliate/catalogue providers, or manual catalogue
    ingestion where direct scraping is not permitted or technically reliable.
  - Document source terms and permitted refresh frequency per retailer.
- [x] Establish a live-data launch threshold.
  - Require successful scheduled extraction for at least two retailers.
  - Require freshness, expiry, provenance, and monitoring coverage.
  - Require a seven-day reliability run before enabling the `Live` badge.
  - Until then, label the feature `Recently observed prices` or `Catalogue offers`.

## P2 - Make the Product Stand Out

- [x] Build a weekly `Goal-to-Cart` experience.
  - Inputs: nutrition goal, budget, household size, schedule, cooking time,
    dietary rules, pantry items, and preferred retailers.
  - Output: an editable meal plan, nutrition forecast, and priced basket.
  - Explain every substitution using cost, nutrition, time, and waste trade-offs.
- [x] Add adaptive replanning.
  - Rebalance the remaining day after a logged meal or workout.
  - Replace unavailable/expensive ingredients without breaking macros or budget.
  - Turn leftovers into the next meal and flag ingredients likely to be wasted.
- [x] Add receipt and pantry capture.
  - Scan a receipt or pantry photo, confirm extracted items, then update inventory.
  - Suggest meals using what will expire first.
- [x] Add a transparent value score for products and specials.
  - Combine normalized price, protein/fibre density, goal fit, pack size, and waste.
  - Show the calculation instead of presenting an unexplained AI score.
- [x] Add local-market intelligence.
  - Retailer-specific specials, realistic pack sizes, local staples, and seasonal
    availability should be a core advantage in every supported market.
- [x] Add outcome-focused weekly reviews.
  - Compare adherence, spend, waste, weight trend, energy, and preferred meals.
  - Suggest one or two achievable changes rather than a dense analytics report.

## P2 - Nutri Agent

- [x] Add an agent entry point focused on actions, not open-ended chat.
  - Example prompts: `Plan my week under R900`, `Use what is in my pantry`,
    `Swap tonight's dinner`, and `Make my basket cheaper without losing protein`.
- [x] Give the agent typed tools for profile, logs, recipes, meal plans, pantry,
  retailer prices, specials, and baskets.
- [x] Use deterministic nutrition and pricing services for calculations; use the
  model to interpret intent, compare options, explain, and orchestrate tools.
- [x] Show a preview/diff before the agent changes a plan, log, profile, or basket.
- [x] Require confirmation for writes and make agent changes undoable.
- [x] Include assumptions, missing data, confidence, price freshness, and the
  reason behind each recommendation.
- [ ] Store a concise preference memory that users can inspect, edit, or clear.
- [ ] Add safety boundaries.
  - Do not diagnose or prescribe treatment.
  - Detect high-risk goals and direct users toward qualified medical guidance.
  - Avoid aggressive deficits and clearly label estimates.
- [ ] Evaluate the agent with repeatable scenarios for nutrition correctness,
  budget adherence, dietary constraints, tool-call safety, and hallucinations.

## P2 - Cravings and Cycle-Aware Support

- [ ] Add a craving assistant that starts with what the user actually wants.
  - Support craving profiles such as sweet, salty, chocolate, creamy, crunchy,
    warm/comforting, and high-volume.
  - Ask about intensity, hunger, available ingredients, budget, allergies, and
    whether the user wants the original food, a balanced pairing, or a substitute.
  - Never moralize foods as `good`, `bad`, `clean`, or a failure.
- [ ] Provide a three-option substitution ladder.
  - `Closest match`: preserve taste and texture with a modest nutrition improvement.
  - `Balanced pairing`: keep the craved food and pair it with protein, fibre, or
    another filling component.
  - `Goal-aligned alternative`: offer a stronger macro/budget substitution when
    the user explicitly wants one.
  - Show calories/macros, portion assumptions, price, availability, and why each
    option may satisfy the specific craving.
- [ ] Let users accept, edit, dismiss, or log a craving suggestion in one action.
- [ ] Learn from outcomes instead of repeatedly suggesting rejected substitutes.
  - Ask whether the option was satisfying and remember taste/texture preferences.
  - Keep this preference memory visible, editable, and deletable.
- [ ] Add an explicit opt-in menstrual-cycle and symptom profile.
  - Track period dates, cycle variability, bleeding, cramps, bloating, headaches,
    energy, sleep, mood, appetite, cravings, digestion, and exercise tolerance.
  - Allow symptom tracking without requiring cycle prediction.
  - Support irregular cycles, hormonal contraception, perimenopause, postpartum
    changes, and users who do not identify as women.
- [ ] Treat cycle phases as estimates, not facts.
  - Display prediction confidence and the data used to estimate the phase.
  - Personalize only after enough observations; prioritize the user's current
    symptoms over a calendar-based phase assumption.
  - Never use phase prediction as contraception, fertility advice, or diagnosis.
- [ ] Build supportive, food-first suggestions for reported symptoms.
  - For appetite changes or cravings, suggest satisfying meals/snacks with complex
    carbohydrates, protein, fibre, and calcium-rich food options where suitable.
  - For bloating or fatigue, offer gentle meal, hydration, sleep, and preparation
    ideas without promising treatment.
  - Do not recommend supplement doses or medication without clinician involvement.
- [ ] Add cycle-aware planning controls.
  - Let users request easier meals, more snack flexibility, comfort-food swaps,
    adjusted meal timing, lower-prep baskets, or gentler activity suggestions.
  - Replan only after showing the effect on nutrition, budget, and basket contents.
  - Never automatically reduce or increase calorie targets solely from cycle phase.
- [ ] Add longitudinal pattern insights after at least two to three tracked cycles.
  - Example: `Chocolate cravings were logged before 3 of your last 3 periods`.
  - Clearly separate observed personal patterns from general educational content.
  - Allow users to correct or hide inferred patterns.
- [ ] Add clinical safety escalation.
  - Encourage professional care for severe pain, very heavy or irregular bleeding,
    fainting, persistent fatigue, symptoms disrupting daily life, or possible PMDD.
  - Provide an immediate crisis pathway for severe depression, hopelessness, or
    self-harm signals; do not let the nutrition agent manage these alone.
- [ ] Protect cycle and symptom data as highly sensitive information.
  - Make collection optional and explain exactly how each field is used.
  - Provide export, correction, deletion, retention controls, and discreet
    notifications.
  - Do not use cycle, fertility, pregnancy, or symptom data for advertising.
- [ ] Validate the feature with clinicians and representative users.
  - Include people with regular and irregular cycles, hormonal contraception,
    PCOS/endometriosis experiences, perimenopause, different dietary cultures,
    and histories of disordered eating.
  - Test for stereotyping, over-restriction, unsafe deficit advice, and false
    certainty about phase-specific nutritional needs.

## P3 - Product Polish and Growth

- [ ] Add household profiles and shared baskets without mixing nutrition targets.
- [ ] Add retailer price freshness and availability timestamps.
- [ ] Add plan-versus-actual grocery spend and food-waste tracking.
- [ ] Add shareable meal plans and baskets with privacy controls.
- [ ] Add notification preferences for expiring food, specials, meal prep, and
  gentle logging reminders.
- [ ] Instrument onboarding completion, first logged meal, first generated basket,
  weekly plan adoption, substitution acceptance, and retained weekly use.

## Suggested Delivery Order

1. Reliability, validation, API health, and error states.
2. Live retailer provenance, promotion ingestion, freshness, and monitoring.
3. Shared profile/state/mutation foundations and end-to-end tests.
4. Simplified Track and Shop navigation.
5. Goal-to-Cart without AI, using deterministic planning and basket services.
6. Craving substitution assistant with preference learning and safety tests.
7. Nutri Agent as a controlled orchestration layer over those trusted services.
8. Opt-in cycle/symptom tracking and clinician-reviewed support.
9. Pantry capture, adaptive replanning, and weekly outcome reviews.
