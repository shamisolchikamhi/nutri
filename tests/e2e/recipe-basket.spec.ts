import { expect, test } from "@playwright/test";

test("saves a recipe and creates its grocery basket", async ({ page }) => {
  await page.goto("/recipes/1");
  await expect(page.getByRole("heading", { name: "High Protein Chicken Bowl" })).toBeVisible();

  await page.getByRole("button", { name: "Save recipe" }).click();
  await expect(page.getByText("The recipe was added to Saved.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove recipe from saved" })).toBeVisible();

  await page.getByRole("button", { name: "Add Ingredients to Basket" }).click();
  await expect(page).toHaveURL(/\/basket\/1$/);
  await expect(page.getByRole("heading", { name: "High Protein Chicken Bowl Shopping" })).toBeVisible();
  await expect(page.getByText("Chicken Breast 500g", { exact: true })).toBeVisible();
  await expect(page.getByText("R 70", { exact: true })).toHaveCount(3);
});
