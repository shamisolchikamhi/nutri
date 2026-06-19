import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { retailerAdapters, type RetailerKey } from "./index";

const cases: Array<{ key: RetailerKey; fixture: string; name: string; packSize: number }> = [
  { key: "woolworths", fixture: "woolworths.html", name: "Woolworths Rolled Oats 1kg", packSize: 1 },
  { key: "pick-n-pay", fixture: "pick-n-pay.html", name: "PnP Chicken Breast 500g", packSize: 500 },
  { key: "checkers", fixture: "checkers.html", name: "Checkers Greek Yoghurt 1kg", packSize: 1 },
];

for (const fixture of cases) {
  test(`${fixture.key} adapter satisfies the retailer listing contract`, async () => {
    const html = await readFile(resolve("fixtures/retailers/v1", fixture.fixture), "utf8");
    const listings = retailerAdapters[fixture.key].parse(html, `https://fixture.test/${fixture.key}`);
    assert.equal(listings.length, 1, "a previously healthy fixture must never extract zero products");
    const listing = listings[0];
    assert.equal(listing.retailer, fixture.key);
    assert.equal(listing.name, fixture.name);
    assert.equal(listing.packSize, fixture.packSize);
    assert.equal(listing.currency, "ZAR");
    assert.ok(listing.price > 0);
    assert.ok(listing.regularPrice && listing.regularPrice > listing.price);
    assert.equal(listing.promotionType, "single_price");
    assert.match(listing.validFrom ?? "", /^2026-06-/);
    assert.match(listing.validUntil ?? "", /^2026-06-/);
    assert.match(listing.sourceUrl, /^https:\/\//);
  });
}
