import { expect, test } from "@playwright/test";

test("captures receipt text, confirms pantry items, and suggests meals", async ({ page }) => {
  await page.goto("/pantry");

  await expect(page.getByRole("heading", { name: "Pantry" })).toBeVisible();
  await page.getByLabel("Receipt or pantry text").fill("Greek yoghurt 500g\nBrown rice 1kg\nBaby spinach");
  await page.getByRole("button", { name: "Capture items" }).click();

  await expect(page.getByText("Review captured items")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Greek yoghurt" })).toBeVisible();

  await page.getByRole("button", { name: "Confirm Greek yoghurt" }).click();
  await expect(page.getByRole("heading", { name: "Inventory" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Greek yoghurt" })).toBeVisible();
  await expect(page.getByText("Uses pantry items before they expire.")).toBeVisible();
});
