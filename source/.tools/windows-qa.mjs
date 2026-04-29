#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const rootDir = process.cwd();
const outputDir = path.join(rootDir, ".tools");
const baseUrl = String(process.env.QA_BASE_URL || "http://127.0.0.1:4173").replace(/\/+$/, "");

function outputPath(fileName) {
  return path.join(outputDir, fileName);
}

async function waitForRoute(page, pathname) {
  await page.waitForFunction(
    (expectedPathname) => window.location.pathname === expectedPathname,
    pathname
  );
}

async function captureRoute(contextOptions, fileName, pathname) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    colorScheme: "light",
    ...contextOptions,
  });

  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}${pathname}`, { waitUntil: "networkidle" });
    await waitForRoute(page, pathname);
    await page.screenshot({ path: outputPath(fileName), fullPage: true });
  } finally {
    await context.close();
    await browser.close();
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const routes = [
    { fileStem: "root", pathname: "/" },
    { fileStem: "about", pathname: "/about" },
    { fileStem: "login", pathname: "/login" },
    { fileStem: "forgot-password", pathname: "/forgot-password" },
  ];

  for (const route of routes) {
    await captureRoute({}, `chromium-${route.fileStem}.png`, route.pathname);
    await captureRoute(
      { javaScriptEnabled: false },
      `chromium-${route.fileStem}-static.png`,
      route.pathname
    );
  }

  console.log(`Saved Windows QA screenshots to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
