import { expect, test } from "@playwright/test";

test("builds a pantry-first plan, swaps meals, and accepts missing items as a shopping list", async ({ page }) => {
  await page.goto("/meal-plan");

  await expect(page.getByRole("heading", { name: "Meal Plan" })).toBeVisible();
  await page.getByLabel("Household size").fill("2");
  await page.getByLabel("Weekly budget").fill("900");
  await page.getByLabel("Max cooking time").fill("45");
  await expect(page.getByText("Pantry inventory is prioritised")).toBeVisible();
  await expect(page.getByText(/Using Brown rice \(1 kg\)/)).toBeVisible();
  await expect(page.getByText("High Protein Chicken Bowl", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Cost trade-off/)).toBeVisible();
  await expect(page.getByText(/Waste trade-off/)).toBeVisible();
  await expect(page.getByText("R 716 budget left")).toBeVisible();
  await expect(page.getByText("Adaptive replan")).toBeVisible();
  await expect(page.getByText(/Rebalances the day/)).toBeVisible();
  await expect(page.getByText(/Use firm tofu/)).toBeVisible();
  await expect(page.getByText(/carry leftovers into tomorrow/)).toBeVisible();
  await expect(page.getByText(/plan another meal using it this week/)).toBeVisible();
  await expect(page.getByText("In pantry: Brown rice")).toBeVisible();
  await expect(page.getByText("Shopping list: Chicken breast")).toBeVisible();

  await page.getByRole("button", { name: "Swap" }).click();
  await expect(page.getByText("Tofu Rice Bowl")).toBeVisible();
  await expect(page.getByText("Shopping list: Firm tofu")).toBeVisible();

  await page.getByRole("button", { name: "Accept plan" }).click();
  await expect(page.getByText("Plan accepted", { exact: true })).toBeVisible();
  await expect(page.getByText("1 missing item added to your shopping list.")).toBeVisible();
  await page.getByRole("button", { name: "Open shopping list" }).click();
  await expect(page).toHaveURL(/\/basket\/1$/);
});
