import { expect, test } from "@playwright/test";

test("groups tracking, shopping, and saved routes into workspaces", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByRole("link", { name: "Track", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Activity", exact: true }).click();
  await expect(page).toHaveURL(/\/tracker\/activity$/);
  await expect(page.getByRole("heading", { name: "Activity Log" })).toBeVisible();

  await expect(page.getByRole("link", { name: "Shop", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Specials", exact: true }).click();
  await expect(page).toHaveURL(/\/specials$/);

  await page.getByRole("link", { name: "Library", exact: true }).click();
  await expect(page).toHaveURL(/\/saved$/);
  await expect(page.getByRole("heading", { name: "Saved" })).toBeVisible();
});
