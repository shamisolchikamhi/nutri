import { expect, test } from "@playwright/test";

test("empty states explain prerequisites and provide one recovery action", async ({ page }) => {
  await page.goto("/products");
  await page.getByPlaceholder("Search products...").fill("missing");
  await expect(page.getByText("No products match", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByText("Chicken Breast 500g", { exact: true })).toBeVisible();

  await page.goto("/tracker/history");
  await expect(page.getByText("No nutrition history yet", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Log first meal" }).click();
  await expect(page).toHaveURL(/\/tracker$/);

  await page.goto("/basket");
  await expect(page.getByText("No retailer shops yet", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Create your first shop" }).click();
  await expect(page.getByRole("heading", { name: "Create Retailer Shop" })).toBeVisible();
});
