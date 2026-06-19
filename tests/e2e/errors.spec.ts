import { expect, test } from "@playwright/test";

test("write failures show a user-focused message and stable code", async ({ page }) => {
  await page.route("**/api/recipes/1", async (route) => {
    const response = await route.fetch();
    const recipe = await response.json();
    await route.fulfill({ response, json: { ...recipe, isSaved: false } });
  });
  await page.route("**/api/saved/recipes", async (route) => {
    await route.fulfill({ status: 500, contentType: "text/html", body: "<h1>HTTP 500 Internal Server Error</h1>" });
  });

  await page.goto("/recipes/1");
  await page.getByRole("button", { name: "Save recipe" }).click();

  await expect(page.getByText("Nothing was changed. Try again or contact support with reference WRITE-RECIPE-SAVE.", { exact: true })).toBeVisible();
  await expect(page.getByText(/HTTP 500/)).toHaveCount(0);
});
