import { expect, test } from "@playwright/test";

const viewports = [
  { name: "320px mobile", width: 320, mobileNavigation: true },
  { name: "390px mobile", width: 390, mobileNavigation: true },
  { name: "768px tablet", width: 768, mobileNavigation: false },
  { name: "desktop", width: 1280, mobileNavigation: false },
];

for (const viewport of viewports) {
  test(`dashboard layout works at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: 900 });
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)!/ })).toBeVisible();

    const dashboardLink = page.getByRole("link", { name: "Dashboard" });
    if (viewport.mobileNavigation) {
      await expect(page.getByRole("navigation", { name: "Primary mobile navigation" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
      await expect(dashboardLink).toBeHidden();
      await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    }
    await expect(dashboardLink).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
}
