import assert from "node:assert/strict";
import test from "node:test";
import { isPathAllowed } from "./browser-fetch";
import { lawfulFallbackForBlockedSource, retailerSourcePolicies } from "./source-policies";

test("robots policy blocks disallowed catalogue paths", () => {
  const robots = "User-agent: *\nDisallow: /account\nDisallow: /private-catalogue";
  assert.equal(isPathAllowed(robots, "/products/oats"), true);
  assert.equal(isPathAllowed(robots, "/private-catalogue/week-1"), false);
});

test("blocked retailer sources choose a lawful non-scraping fallback", () => {
  const fallback = lawfulFallbackForBlockedSource("checkers");
  assert.equal(fallback.action, "stop_direct_scraping");
  assert.equal(fallback.fallback, retailerSourcePolicies.checkers.approvedFallbacks[0]);
  assert.match(fallback.permittedRefreshFrequency, /robots\.txt/);
});
