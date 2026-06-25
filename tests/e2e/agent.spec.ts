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
  await expect(page.getByText("Deterministic calculation contract")).toBeVisible();
  await expect(page.getByText("service calculates").first()).toBeVisible();
  await expect(page.getByText("model orchestrates")).toBeVisible();
  await expect(page.getByText("The model does not invent totals or prices; it cites service outputs and missing data.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview diff" })).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Start action" })).toHaveCount(4);
  await page.getByRole("button", { name: "Preview diff" }).first().click();
  await expect(page.getByRole("dialog", { name: "Weekly plan preview" })).toBeVisible();
  await expect(page.getByText("Current plan stays unchanged")).toBeVisible();
  await expect(page.getByText("7-day draft plan under R900")).toBeVisible();
  await expect(page.getByText("No plan changes are applied from this preview.")).toBeVisible();
});
