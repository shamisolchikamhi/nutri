import assert from "node:assert/strict";
import test from "node:test";
import { isPathAllowed } from "./browser-fetch";

test("robots policy blocks disallowed catalogue paths", () => {
  const robots = "User-agent: *\nDisallow: /account\nDisallow: /private-catalogue";
  assert.equal(isPathAllowed(robots, "/products/oats"), true);
  assert.equal(isPathAllowed(robots, "/private-catalogue/week-1"), false);
});
