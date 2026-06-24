import assert from "node:assert/strict";
import test from "node:test";
import { applyDataQualityGates, buildScraperAlerts, type ScrapedProduct } from "../scrape-za-retailers";

function product(overrides: Partial<ScrapedProduct> = {}): ScrapedProduct {
  return {
    externalId: "sku-1",
    sourceUrl: "https://retailer.test/product/sku-1",
    name: "Test Oats 1kg",
    brand: "Test",
    category: "grains",
    currency: "ZAR",
    priceAud: 39.99,
    regularPriceAud: 49.99,
    promotionType: "single_price",
    validFrom: "2026-06-01",
    validUntil: "2026-06-30",
    packSize: 1,
    packUnit: "kg",
    caloriesPer100g: 389,
    proteinPer100g: 16,
    carbsPer100g: 66,
    fatPer100g: 6,
    fiberPer100g: 10,
    sugarPer100g: 1,
    imageUrl: "",
    ...overrides,
  };
}

test("data-quality gates accept complete retailer products", () => {
  const result = applyDataQualityGates([product()], "Test Retailer");
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.reviewQueue.length, 0);
});

test("data-quality gates reject invalid publish records and queue review", () => {
  const result = applyDataQualityGates([
    product({ externalId: "bad-price", priceAud: 0 }),
    product({ externalId: "bad-saving", regularPriceAud: 20 }),
    product({ externalId: "bad-currency", currency: "USD" }),
    product({ externalId: "missing-dates", validFrom: null }),
    product({ externalId: "ambiguous-pack", name: "Loose oats", packSize: 1, packUnit: "unit" }),
  ], "Test Retailer");

  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected.length, 5);
  assert.equal(result.reviewQueue.length, 5);
  assert.deepEqual(result.rejected.map((item) => item.reasons[0]), [
    "invalid price",
    "impossible savings",
    "mismatched currency USD",
    "missing promotion dates",
    "ambiguous pack size",
  ]);
});

test("data-quality gates reject duplicate products", () => {
  const result = applyDataQualityGates([product(), product()], "Test Retailer");
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.ok(result.rejected[0].reasons.includes("duplicate product"));
});

test("scraper observability alerts on blocked or sharply low extraction runs", () => {
  const alerts = buildScraperAlerts({
    requests: 3,
    successfulRequests: 1,
    failedRequests: 2,
    blockedRequests: 1,
    extractionCount: 1,
    parseFailures: 1,
    changedPrices: 0,
    newPromotions: 0,
    expiredPromotions: 0,
    lastSuccessfulRun: "2026-06-24T10:00:00.000Z",
  }, 5);

  assert.deepEqual(alerts, [
    "blocked requests detected: 1",
    "extraction count below threshold: 1/5",
  ]);
});
