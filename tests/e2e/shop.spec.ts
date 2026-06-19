import { expect, test } from "@playwright/test";

test("filters products, views specials, and compares a basket", async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByText("Chicken Breast 500g", { exact: true })).toBeVisible();

  await page.getByPlaceholder("Search products...").fill("chicken");
  await expect(page.getByText("Chicken Breast 500g", { exact: true })).toBeVisible();

  const filters = page.getByRole("combobox");
  await expect(filters).toHaveCount(2);
  await filters.nth(0).click();
  await page.getByRole("option", { name: "Test Market" }).click();
  await expect(filters.nth(0)).toContainText("Test Market");
  await filters.nth(1).click();
  await page.getByRole("option", { name: "Protein" }).click();
  await expect(filters.nth(1)).toContainText("Protein");

  await page.getByRole("button", { name: "Specials" }).click();
  await expect(page.getByText("SPECIAL", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByRole("heading", { name: "Price Comparison" })).toBeVisible();
  await expect(page.getByText("Cheapest", { exact: true })).toBeVisible();

  await page.goto("/specials");
  await expect(page.getByText("Chicken Breast 500g", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Best Value" }).click();
  await expect(page.getByText("Best Value Chicken", { exact: true })).toBeVisible();

  await page.goto("/basket/1");
  await expect(page.getByText("Basket price by store", { exact: true })).toBeVisible();
  await expect(page.getByText("Test Market", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Value Mart", { exact: true })).toBeVisible();
  await expect(page.getByText("Best", { exact: true })).toBeVisible();
});
