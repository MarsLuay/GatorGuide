#!/usr/bin/env node

import { chromium } from "playwright";

const baseUrl = String(process.env.QA_BASE_URL || "http://127.0.0.1:4173").replace(/\/+$/, "");

async function waitForPathname(page, expectedPathname) {
  await page.waitForFunction(
    (pathname) => window.location.pathname === pathname,
    expectedPathname
  );
}

async function gotoPath(page, pathname) {
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "networkidle" });
  await waitForPathname(page, pathname);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });

  try {
    await gotoPath(page, "/resources");

    const searchInput = page.locator("input").first();
    await searchInput.fill("WSOS");
    await page.waitForTimeout(250);
    await searchInput.fill("Deadline Calendar");
    await page.waitForTimeout(250);

    const deadlineCalendarLink = page.getByText("Deadline Calendar", { exact: true }).first();
    if ((await deadlineCalendarLink.count()) > 0) {
      await deadlineCalendarLink.click();
    } else {
      await gotoPath(page, "/calendar");
    }
    await waitForPathname(page, "/calendar");

    await gotoPath(page, "/about");
    await waitForPathname(page, "/about");

    await gotoPath(page, "/privacy");
    await waitForPathname(page, "/privacy");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
