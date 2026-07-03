import { expect, test } from "@playwright/test";

test("opens a craving assistant that starts with what the user wants", async ({ page }) => {
  await page.goto("/cravings");

  await expect(page.getByRole("heading", { name: "Craving Assistant" })).toBeVisible();
  await expect(page.getByText("Start with what you actually want")).toBeVisible();

  for (const profile of ["sweet", "salty", "chocolate", "creamy", "crunchy", "warm/comforting", "high-volume"]) {
    await expect(page.getByRole("button", { name: profile })).toBeVisible();
  }

  await page.getByRole("button", { name: "crunchy" }).click();
  await page.getByLabel("Budget").fill("R35");
  await page.getByLabel("Available ingredients").fill("yoghurt, apples, oats");
  await page.getByLabel("Allergies or avoidances").fill("peanuts");
  await page.getByRole("button", { name: "I want the original food" }).click();

  await expect(page.getByText("crunchy")).toBeVisible();
  await expect(page.getByText("I want the original food")).toBeVisible();
  await expect(page.getByText("stay near R35")).toBeVisible();
  await expect(page.getByText("respect peanuts")).toBeVisible();
  await expect(page.getByText("No moral labels, shame language, or failure framing.")).toBeVisible();
});
