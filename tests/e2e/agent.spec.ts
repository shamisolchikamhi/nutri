import { expect, test } from "@playwright/test";

test("uses a simple chat with suggested questions, previews, preferences, and terms", async ({ page }) => {
  await page.goto("/agent");

  await expect(page.getByRole("heading", { name: "Nutri Agent" })).toBeVisible();
  await expect(page.getByText("What would you like help with?")).toBeVisible();
  await expect(page.getByText("Suggested questions")).toBeVisible();
  await expect(page.getByRole("button", { name: "Plan my week under R900" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use what is in my pantry" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Swap tonight's dinner" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Make my basket cheaper" })).toBeVisible();

  await page.getByRole("button", { name: "Use what is in my pantry" }).click();
  await expect(page.getByText("I’ll start with confirmed pantry items")).toBeVisible();
  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("dialog", { name: "Pantry-first preview" })).toBeVisible();
  await page.getByRole("button", { name: "Back to chat" }).click();

  await page.getByLabel("Message Nutri Agent").fill("Can you make my shopping basket cheaper?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("I’ll compare matching products and current specials")).toBeVisible();

  await page.getByRole("button", { name: "Preferences" }).click();
  await expect(page.getByLabel("Preference memory")).toHaveValue(/budget-aware/);
  await page.getByLabel("Preference memory").fill("Likes quick dinners and pantry-first plans.");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByText("Preferences saved.")).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByLabel("Preference memory")).toHaveValue("");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "terms and safety conditions" }).click();
  await expect(page.getByRole("dialog", { name: "Nutri Agent terms and safety conditions" })).toBeVisible();
  await expect(page.getByText("provides planning and educational support, not medical diagnosis or treatment")).toBeVisible();
  await expect(page.getByText("High-risk goals are escalated")).toBeVisible();
});
