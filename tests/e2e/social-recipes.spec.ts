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

test("imports a social recipe and creates a basket in the local artifact", async ({ page }) => {
  await page.goto("/recipes");
  await page.getByRole("button", { name: "Social" }).click();

  await page.getByLabel("Post URL").fill("https://www.tiktok.com/@creator/video/123");
  await page.getByLabel("Title").fill("Creator chicken bowl");
  await page.getByLabel("Ingredients", { exact: true }).fill("Chicken breast\nBrown rice\nBroccoli");
  await page.getByRole("button", { name: "Analyze recipe and match local products" }).click();

  await expect(page).toHaveURL(/\/basket\/1$/);
  await expect(page.getByRole("heading", { name: "Creator chicken bowl Shopping" })).toBeVisible();
  await expect(page.getByText("Chicken breast", { exact: true })).toBeVisible();
});

test("does not invent a recipe for a TikTok URL without visible ingredients", async ({ page }) => {
  await page.goto("/recipes");
  await page.getByRole("button", { name: "Social" }).click();

  await page.getByLabel("Post URL").fill("https://vt.tiktok.com/ZSCNqrCLA/");
  await page.getByRole("button", { name: "Analyze recipe and match local products" }).click();

  await expect(page.getByText("TikTok short links do not expose recipe ingredients in the local artifact.")).toBeVisible();
  await expect(page).toHaveURL(/\/recipes$/);
});
