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

test("takes a receipt image, analyses it, and stages extracted items for confirmation", async ({ page }) => {
  await page.goto("/pantry");

  const photoInput = page.getByLabel("Receipt photo");
  await expect(photoInput).toHaveAttribute("capture", "environment");
  await photoInput.setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });

  await expect(page.getByText("1 receipt image(s) ready to analyse")).toBeVisible();
  await page.getByRole("button", { name: "Analyse receipt" }).click();

  await expect(page.getByText("Review captured items")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm Greek yoghurt" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm Greek yoghurt" }).click();
  await expect(page.getByRole("button", { name: "Save Greek yoghurt" })).toBeVisible();
});
