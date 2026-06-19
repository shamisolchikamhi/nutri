import { expect, test } from "@playwright/test";

test("onboarding saves a valid profile and loads the dashboard", async ({ page }) => {
  await page.goto("/onboarding");

  await page.getByRole("button", { name: "Continue →" }).click();
  await expect(page.getByRole("alert")).toHaveText("Age is required");
  await expect(page.getByText("Step 1 of 3")).toBeVisible();

  await page.getByLabel("Age").fill("41");
  await page.getByRole("button", { name: "Continue →" }).click();

  await page.getByLabel("Height (cm)").fill("181");
  await page.getByLabel("Current weight (kg)").fill("86");
  await page.getByLabel("Target weight (kg)").fill("78");
  await page.getByRole("button", { name: "Continue →" }).click();

  await page.getByRole("button", { name: "Complete Setup" }).click();
  await expect(page.getByRole("heading", { name: "You're all set!" })).toBeVisible();

  await page.getByRole("button", { name: "Go to Dashboard →" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("/ 2000 kcal", { exact: true })).toBeVisible();
  await expect(page.getByText("Nutrition targets unavailable", { exact: true })).toHaveCount(0);
});

test("onboarding supports a keyboard-only step transition", async ({ page }) => {
  await page.goto("/onboarding");

  const age = page.getByLabel("Age");
  await age.focus();
  await age.fill("41");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Continue →" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await expect(page.getByLabel("Height (cm)")).toBeFocused();
});
