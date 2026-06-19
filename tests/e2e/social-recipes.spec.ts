import { expect, test } from "@playwright/test";

test("opens the social recipe importer and guides an empty library", async ({ page }) => {
  await page.goto("/recipes");
  await page.getByRole("button", { name: "Social" }).click();

  await expect(page.getByRole("heading", { name: "Import social recipe" })).toBeVisible();
  await expect(page.getByLabel("Post URL")).toBeVisible();
  await expect(page.getByLabel("Recipe screenshots or video")).toBeVisible();
  await expect(page.getByText("No social recipes imported yet", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add recipe source" }).click();
  await expect(page.getByLabel("Post URL")).toBeFocused();
});
