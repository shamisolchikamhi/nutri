import { expect, test } from "@playwright/test";

test("opens an action-focused Nutri Agent entry point", async ({ page }) => {
  await page.goto("/agent");

  await expect(page.getByRole("heading", { name: "Nutri Agent" })).toBeVisible();
  await expect(page.getByText("Start with a concrete action.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plan my week under R900" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Use what is in my pantry" })).toBeVisible();
  await expect(page.getByText("No open-ended medical advice or diagnosis.")).toBeVisible();
  await expect(page.getByText("Typed tool surface")).toBeVisible();
  await expect(page.getByText("Compares observed prices, pack sizes, freshness, and retailer availability.")).toBeVisible();
  await expect(page.getByText("Preview and confirmation required before writes.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Start action" })).toHaveCount(4);
});
