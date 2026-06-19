import { expect, test } from "@playwright/test";

test("logs a meal, water, activity, and weight", async ({ page }) => {
  await page.goto("/tracker");
  await expect(page.getByRole("heading", { name: "Meal Tracker" })).toBeVisible();

  await page.getByRole("button", { name: "Log Meal" }).click();
  await page.getByRole("button", { name: "Egg (1 large)" }).click();
  await page.getByRole("button", { name: "Log Entry" }).click();
  await expect(page.getByText("Egg (1 large)", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "+250ml" }).click();
  await expect(page.getByText("250 / 2500 ml", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Remove Egg (1 large)" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Remove Egg (1 large)?");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Egg (1 large)", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Remove Egg (1 large)" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(5_200);
  await expect(page.getByText("Egg (1 large)", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Remove Egg (1 large)" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Egg (1 large)", { exact: true })).toHaveCount(0, { timeout: 8_000 });

  await page.goto("/tracker/activity");
  await page.getByRole("button", { name: "Add Activity" }).click();
  await page.getByPlaceholder("30").fill("30");
  await page.getByPlaceholder("200").fill("200");
  await page.getByPlaceholder("8000").fill("8000");
  await page.getByRole("button", { name: "Log Activity" }).click();
  await expect(page.getByText("walking", { exact: true })).toBeVisible();
  await expect(page.getByText("8,000 steps", { exact: true })).toBeVisible();

  await page.goto("/progress");
  await page.getByRole("spinbutton").fill("85");
  await page.getByRole("button", { name: "Log" }).click();
  await expect(page.getByText("85", { exact: true })).toBeVisible();
  await expect(page.getByText("Your weight entry was saved.", { exact: true })).toBeVisible();
});
