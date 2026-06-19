import { expect, test } from "@playwright/test";

test("onboarding saves a valid profile and loads the dashboard", async ({ page }) => {
  await page.goto("/onboarding");

  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByRole("alert")).toHaveText("Age is required");
  await expect(page.getByText("Step 1 of 3")).toBeVisible();

  await page.getByRole("spinbutton").fill("41");
  await page.getByRole("button", { name: "Continue →" }).click();

  const bodyFields = page.getByRole("spinbutton");
  await expect(bodyFields).toHaveCount(3);
  await bodyFields.nth(0).fill("181");
  await bodyFields.nth(1).fill("86");
  await bodyFields.nth(2).fill("78");
  await page.getByRole("button", { name: "Continue →" }).click();

  await page.getByRole("button", { name: "Complete Setup" }).click();
  await expect(page.getByRole("heading", { name: "You're all set!" })).toBeVisible();

  await page.getByRole("button", { name: "Go to Dashboard →" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("/ 2000 kcal", { exact: true })).toBeVisible();
  await expect(page.getByText("Nutrition targets unavailable", { exact: true })).toHaveCount(0);
});
