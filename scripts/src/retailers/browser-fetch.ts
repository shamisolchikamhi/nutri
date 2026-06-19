import { chromium } from "@playwright/test";

const USER_AGENT = "NutriBasket/0.1 retail data importer (+development)";
const lastRequestByHost = new Map<string, number>();

export function isPathAllowed(robotsText: string, pathname: string, userAgent = "nutribasket") {
  let applies = false;
  const disallowed: string[] = [];
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") applies = value === "*" || value.toLowerCase() === userAgent.toLowerCase();
    else if (field === "disallow" && applies && value) disallowed.push(value);
  }
  return !disallowed.some((path) => pathname.startsWith(path));
}

async function assertRobotsAllowed(url: URL) {
  const robotsUrl = new URL("/robots.txt", url);
  const response = await fetch(robotsUrl, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
  if (response.ok && !isPathAllowed(await response.text(), url.pathname)) {
    throw new Error(`robots.txt disallows ${url.pathname}`);
  }
}

async function throttle(host: string, delayMs = 1_500) {
  const wait = Math.max(0, (lastRequestByHost.get(host) ?? 0) + delayMs - Date.now());
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestByHost.set(host, Date.now());
}

export async function fetchRenderedHtml(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only public HTTP(S) retailer pages are supported");
  if (url.username || url.password) throw new Error("Authenticated retailer URLs are not supported");
  await assertRobotsAllowed(url);
  await throttle(url.host);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT });
    const page = await context.newPage();
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(1_000);
    return await page.content();
  } finally {
    await browser.close();
  }
}
