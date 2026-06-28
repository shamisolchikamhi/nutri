import { expect, test } from "@playwright/test";

test("groups tracking and retailer shopping while keeping favorites inside recipes", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("link", { name: "Track", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Track", exact: true }).click();
  await expect(page).toHaveURL(/\/tracker$/);
  await expect(page.getByRole("heading", { name: "Track" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activity Log" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();

  await expect(page.getByRole("link", { name: "Shop", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Retailer shops", exact: true }).click();
  await expect(page).toHaveURL(/\/basket$/);
  await expect(page.getByRole("heading", { name: "Retailer Shops" })).toBeVisible();
  await page.getByRole("link", { name: "Specials", exact: true }).click();
  await expect(page).toHaveURL(/\/specials$/);
  await page.getByRole("link", { name: "Data status", exact: true }).click();
  await expect(page).toHaveURL(/\/retailer-status$/);
  await expect(page.getByRole("heading", { name: "Retailer Data Status" })).toBeVisible();
  await expect(page.getByText("Test Market", { exact: true })).toBeVisible();

  await expect(page.getByRole("link", { name: "Library", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Recipes", exact: true }).click();
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByRole("button", { name: "Favorites" })).toBeVisible();
});
