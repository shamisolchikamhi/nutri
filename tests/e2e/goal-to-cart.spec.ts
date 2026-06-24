import { expect, test } from "@playwright/test";

test("builds a weekly goal-to-cart plan with tradeoff explanations and basket action", async ({ page }) => {
  await page.goto("/meal-plan");

  await expect(page.getByRole("heading", { name: "Meal Plan" })).toBeVisible();
  await page.getByLabel("Household size").fill("2");
  await page.getByLabel("Weekly budget").fill("900");
  await page.getByLabel("Max cooking time").fill("45");
  await page.getByLabel("Pantry items").fill("rice");

  await expect(page.getByText("Weekly Goal-to-Cart planning")).toBeVisible();
  await expect(page.getByText("High Protein Chicken Bowl", { exact: true })).toBeVisible();
  await expect(page.getByText(/Cost trade-off/)).toBeVisible();
  await expect(page.getByText(/Waste trade-off/)).toBeVisible();
  await expect(page.getByText("R 716 budget left")).toBeVisible();

  await page.getByRole("button", { name: "Basket" }).click();
  await expect(page).toHaveURL(/\/basket\/1$/);
});
