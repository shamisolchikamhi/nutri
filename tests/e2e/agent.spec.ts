import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.removeItem("nutribasket.agent.sessionMessages"));
});

test("submits suggested and typed prompts through live chat and confirms editable writes", async ({ page }) => {
  await page.goto("/agent");

  await expect(page.getByRole("heading", { name: "Nutri Agent" })).toBeVisible();
  await expect(page.getByText("What would you like help with?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log 500 ml water" })).toBeVisible();

  await page.getByRole("button", { name: "Log 500 ml water" }).click();
  await expect(page.getByText("I’ve prepared a water entry")).toBeVisible();
  await expect(page.getByText("Review app change")).toBeVisible();
  await expect(page.getByText("Local parser")).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Amount Ml").fill("750");
  await page.getByRole("button", { name: "Save edit" }).click();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("confirmed", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  await page.getByRole("button", { name: "Open saved entry" }).click();
  await expect(page).toHaveURL(/\/tracker$/);
  await expect(page.getByText("750 / 2500 ml")).toBeVisible();
});

test("adds pantry and exact matched meals but clarifies unknown nutrition", async ({ page }) => {
  await page.goto("/agent");

  await page.getByLabel("Message Nutri Agent").fill("Add 6 eggs to my pantry");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Add 6 item eggs to pantry")).toBeVisible();
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("confirmed", { exact: true })).toBeVisible();

  await page.getByLabel("Message Nutri Agent").fill("Log High Protein Chicken Bowl for dinner");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Nutrition Source")).toBeVisible();
  await expect(page.getByText("1 recipe serving")).toBeVisible();

  await page.getByLabel("Message Nutri Agent").fill("I ate mystery stew");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("I won’t invent calories or macros")).toBeVisible();
  await expect(page.getByText("What was the exact food or recipe name and portion size?")).toBeVisible();
});

test("keeps complex offline prompts useful and presents safety as terms", async ({ page }) => {
  await page.goto("/agent");
  await page.getByLabel("Message Nutri Agent").fill("Can you completely reorganize everything?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("OpenAI is unavailable")).toBeVisible();

  await page.getByRole("button", { name: "terms and safety conditions" }).click();
  await expect(page.getByRole("dialog", { name: "Nutri Agent terms and safety conditions" })).toBeVisible();
  await expect(page.getByText("provides planning and educational support, not medical diagnosis or treatment")).toBeVisible();
});

test("confirmation is idempotent", async ({ request }) => {
  const chat = await request.post("/api/agent/chat", { data: { messages: [{ role: "user", content: "Log 200 ml water" }] } });
  expect(chat.ok()).toBeTruthy();
  const actionId = (await chat.json()).proposals[0].id;
  const first = await request.post(`/api/agent/actions/${actionId}/confirm`);
  const second = await request.post(`/api/agent/actions/${actionId}/confirm`);
  expect((await first.json()).duplicate).toBe(false);
  expect((await second.json()).duplicate).toBe(true);
});

test("supports the remaining common app write domains", async ({ request }) => {
  const cases = [
    ["Log my weight as 79 kg", "daily.update"],
    ["Set body fat to 22%", "daily.update"],
    ["Note that energy was good today", "daily.update"],
    ["I walked 30 minutes", "activity.add"],
    ["Set weekly budget to 850", "profile.update"],
    ["Favorite High Protein Chicken Bowl", "favorite.add"],
    ["Create a shop called Agent Shop", "basket.create"],
    ["Accept meal plan recipes 1", "plan.accept"],
    ["Add Chicken Breast to my shop", "basket_item.add"],
  ];
  for (const [content, expectedKind] of cases) {
    const chat = await request.post("/api/agent/chat", { data: { messages: [{ role: "user", content }] } });
    const response = await chat.json();
    expect(response.proposals[0]?.kind).toBe(expectedKind);
    const confirmation = await request.post(`/api/agent/actions/${response.proposals[0].id}/confirm`);
    expect(confirmation.ok()).toBeTruthy();
  }
});
