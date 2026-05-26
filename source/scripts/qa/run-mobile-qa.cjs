#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");
const { getTmpPath } = require("../lib/tmp-layout.cjs");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const rootDir = process.cwd();
const exportDir = path.join(rootDir, ".tools", "qa-web");
const outputDir = getTmpPath(rootDir, "mobile-qa");
const requestedPort = Number.parseInt(process.env.QA_MOBILE_BASE_PORT || "4183", 10);
const providedBaseUrl = process.env.QA_BASE_URL
  ? String(process.env.QA_BASE_URL).replace(/\/+$/, "")
  : "";

const viewports = [
  { name: "iphone-390x844", width: 390, height: 844, isMobile: true },
  { name: "android-360x800", width: 360, height: 800, isMobile: true },
  { name: "tablet-768x1024", width: 768, height: 1024, isMobile: true },
];

const screenshotRoutes = [
  { name: "home", pathname: "/" },
  { name: "resources", pathname: "/resources" },
  { name: "profile", pathname: "/profile" },
  { name: "settings", pathname: "/settings" },
  { name: "transfer-planner", pathname: "/resources/transfer-planner" },
];

const qaAppData = {
  user: {
    uid: "guest-mobile-qa",
    name: "Guest User",
    email: "guest-mobile-qa@gatorguide.local",
    isGuest: true,
    state: "Washington",
    major: "",
    gender: "",
    residencyType: "",
    gpa: "",
    resume: "",
    transcript: "",
    hasSeenOnboarding: true,
  },
  questionnaireAnswers: {},
  notificationsEnabled: false,
  notificationPreferences: {
    transferDeadlines: true,
    collegeDeadlines: true,
    scholarships: true,
    internships: true,
    generalDeadlines: true,
  },
  savedColleges: [],
};

function log(message) {
  process.stdout.write(`[mobile-qa] ${message}\n`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const isWindowsCmd = process.platform === "win32" && /\.cmd$/i.test(command);
    const child = spawn(
      isWindowsCmd ? "cmd.exe" : command,
      isWindowsCmd ? ["/d", "/s", "/c", command, ...args] : args,
      {
        cwd: options.cwd || rootDir,
        stdio: "inherit",
        env: { ...process.env, EXPO_NO_TELEMETRY: "1", ...(options.env || {}) },
        windowsHide: true,
      }
    );

    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`
        )
      );
    });
  });
}

function canListenOnPort(listenPort) {
  return new Promise((resolve) => {
    const probe = http.createServer();
    probe.once("error", () => resolve(false));
    probe.listen(listenPort, "127.0.0.1", () => {
      probe.close(() => resolve(true));
    });
  });
}

async function findAvailablePort(startPort, maxAttempts = 20) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = startPort + offset;
    if (await canListenOnPort(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not find an open localhost QA port starting at ${startPort}.`);
}

function createStaticServer(directory, listenPort) {
  const sockets = new Set();
  const normalizedDirectory = path.normalize(directory);
  const indexFile = path.join(normalizedDirectory, "index.html");

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", `http://127.0.0.1:${listenPort}`);
    const pathname = decodeURIComponent(requestUrl.pathname);
    const candidateRelativePaths =
      pathname === "/"
        ? ["/index.html"]
        : [
            pathname,
            `${pathname}.html`,
            path.posix.join(pathname, "index.html"),
            "/index.html",
          ];

    const filePath = candidateRelativePaths
      .map((relativePath) => path.normalize(path.join(normalizedDirectory, relativePath)))
      .find(
        (candidatePath) =>
          candidatePath.startsWith(normalizedDirectory) &&
          fs.existsSync(candidatePath) &&
          fs.statSync(candidatePath).isFile()
      );

    const resolvedFilePath = filePath || indexFile;

    if (!resolvedFilePath.startsWith(normalizedDirectory) || !fs.existsSync(resolvedFilePath)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    fs.readFile(resolvedFilePath, (error, data) => {
      if (error) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      const ext = path.extname(resolvedFilePath).toLowerCase();
      response.writeHead(200, {
        "Content-Type": mime[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(data);
    });
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(listenPort, "127.0.0.1", () =>
      resolve({
        close: () =>
          new Promise((done) => {
            for (const socket of sockets) {
              socket.destroy();
            }
            if (typeof server.closeAllConnections === "function") {
              server.closeAllConnections();
            }
            server.close(() => done());
          }),
      })
    );
  });
}

function addFailure(failures, scope, message, details) {
  failures.push({ scope, message, details });
  const detailText = details ? ` ${details}` : "";
  console.error(`[mobile-qa] FAIL ${scope}: ${message}${detailText}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function screenshotPath(viewportName, routeName) {
  return path.join(outputDir, `${viewportName}-${routeName}.png`);
}

async function waitForAppSettled(page) {
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page
    .waitForFunction(
      () =>
        !document.body.innerText.includes("Loading Gator Guide") &&
        !document.body.innerText.includes("Preparing your data") &&
        !document.body.innerText.includes("Loading transfer planner"),
      { timeout: 25000 }
    )
    .catch(() => {});
  await page.waitForTimeout(300);
}

async function gotoPath(page, baseUrl, pathname) {
  await page.goto(`${baseUrl}${pathname}`, { waitUntil: "domcontentloaded" });
  await waitForAppSettled(page);
}

async function findVisibleLocator(locators) {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        return candidate;
      }
    }
  }

  return null;
}

async function clickFirstVisible(page, locators, failures, scope, description, optional = false) {
  const locator = await findVisibleLocator(locators);
  if (!locator) {
    if (!optional) {
      addFailure(failures, scope, `Could not find ${description}.`);
    }
    return false;
  }

  await locator.scrollIntoViewIfNeeded().catch(() => {});
  if (!/bottom tab/i.test(description)) {
    await assertLocatorClearsBottomTab(page, failures, scope, locator, description);
  }
  await locator.click({ timeout: 5000 });
  await waitForAppSettled(page);
  return true;
}

async function assertNoHorizontalOverflow(page, failures, scope) {
  const result = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body ? document.body.scrollWidth : 0
    );
    const overflowBy = documentWidth - viewportWidth;
    const offenders = [];

    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0
      ) {
        continue;
      }

      if (rect.right > viewportWidth + 8 || rect.left < -8) {
        offenders.push({
          tag: element.tagName.toLowerCase(),
          role: element.getAttribute("role") || "",
          label: element.getAttribute("aria-label") || "",
          className: String(element.getAttribute("class") || "").slice(0, 90),
          text: String(element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }

      if (offenders.length >= 4) break;
    }

    return { viewportWidth, documentWidth, overflowBy, offenders };
  });

  if (result.overflowBy > 8) {
    addFailure(
      failures,
      scope,
      `Horizontal overflow by ${Math.round(result.overflowBy)}px.`,
      JSON.stringify(result.offenders)
    );
  }
}

async function assertBottomTabsAndVisibleControls(page, failures, scope) {
  const result = await page.evaluate(() => {
    const tabLabels = ["Home", "Resources", "Profile", "Settings"];
    const candidates = Array.from(
      document.querySelectorAll('[role="button"], button, [aria-label]')
    );
    const tabButtons = tabLabels.map((label) => {
      const lowerLabel = label.toLowerCase();
      return candidates.find((element) => {
        const accessibleName = String(element.getAttribute("aria-label") || element.textContent || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
        return accessibleName === lowerLabel;
      });
    });

    const missing = tabLabels.filter((_, index) => !tabButtons[index]);
    const visibleTabButtons = tabButtons.filter(Boolean);

    const commonAncestor = (elements) => {
      if (!elements.length) return null;
      const firstAncestors = [];
      let current = elements[0];
      while (current) {
        firstAncestors.push(current);
        current = current.parentElement;
      }

      return firstAncestors.find((ancestor) => elements.every((element) => ancestor.contains(element))) || null;
    };

    const tabRoot = commonAncestor(visibleTabButtons);
    const tabRects = visibleTabButtons.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        label: element.getAttribute("aria-label") || element.textContent || "",
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        height: Math.round(rect.height),
        visible: rect.width > 0 && rect.height > 0,
      };
    });
    return { missing, tabRects, hasTabRoot: !!tabRoot };
  });

  if (result.missing.length) {
    addFailure(failures, scope, `Missing bottom tab controls: ${result.missing.join(", ")}.`);
  }

  for (const tabRect of result.tabRects) {
    if (!tabRect.visible || tabRect.height < 44) {
      addFailure(
        failures,
        scope,
        `Bottom tab "${tabRect.label}" is not a comfortable touch target.`,
        JSON.stringify(tabRect)
      );
    }
  }

  if (!result.hasTabRoot) {
    addFailure(failures, scope, "Could not identify the bottom tab bar container.");
  }
}

async function assertLocatorClearsBottomTab(page, failures, scope, locator, description) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return;

  const tabInfo = await page.evaluate(() => {
    const tabLabels = ["Home", "Resources", "Profile", "Settings"];
    const candidates = Array.from(
      document.querySelectorAll('[role="button"], button, [aria-label]')
    );
    const tabButtons = tabLabels
      .map((label) => {
        const lowerLabel = label.toLowerCase();
        return candidates.find((element) => {
          const accessibleName = String(element.getAttribute("aria-label") || element.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
          return accessibleName === lowerLabel;
        });
      })
      .filter(Boolean);

    if (!tabButtons.length) return null;

    const top = Math.min(...tabButtons.map((element) => element.getBoundingClientRect().top));
    return { top, height: window.innerHeight };
  });

  if (!tabInfo) return;

  const boxBottom = box.y + box.height;

  if (boxBottom > tabInfo.top - 4 && box.y < tabInfo.height - 1) {
    addFailure(
      failures,
      scope,
      `${description} is reachable only under the bottom tab bar.`,
      JSON.stringify({
        controlBox: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
          bottom: Math.round(boxBottom),
        },
        tabTop: Math.round(tabInfo.top),
      })
    );
  }
}

async function assertDropdownNotClipped(page, failures, scope, locator) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) {
    addFailure(failures, scope, "Could not measure opened dropdown option.");
    return;
  }

  const viewport = page.viewportSize();
  if (!viewport) return;

  if (box.x < -2 || box.y < -2 || box.x + box.width > viewport.width + 2 || box.y + box.height > viewport.height + 2) {
    addFailure(
      failures,
      scope,
      "Dropdown option is clipped outside the mobile viewport.",
      JSON.stringify({
        optionBox: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
        viewport,
      })
    );
  }
}

async function createMobileContext(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: true,
    colorScheme: "light",
    deviceScaleFactor: viewport.width < 500 ? 2 : 1,
  });

  await context.addInitScript((appData) => {
    window.localStorage.setItem("app-theme", "light");
    window.localStorage.setItem("gatorguide:hasSeenStartup", "true");
    window.localStorage.setItem("gatorguide:guestProfile:show", "true");
    window.localStorage.setItem("gatorguide:guestRoadmap:show", "true");
    window.localStorage.setItem("gatorguide:appdata:v1", JSON.stringify(appData));
  }, qaAppData);

  return context;
}

async function runScreenshotPass(browser, baseUrl, failures) {
  for (const viewport of viewports) {
    const context = await createMobileContext(browser, viewport);
    const page = await context.newPage();

    try {
      for (const route of screenshotRoutes) {
        const scope = `${viewport.name} ${route.name}`;
        log(`Capturing ${scope}...`);
        await gotoPath(page, baseUrl, route.pathname);
        await assertNoHorizontalOverflow(page, failures, scope);
        await assertBottomTabsAndVisibleControls(page, failures, scope);
        await page.screenshot({ path: screenshotPath(viewport.name, route.name), fullPage: true });
      }
    } finally {
      await context.close();
    }
  }
}

async function runBottomTabSmoke(page, baseUrl, failures) {
  const scope = "interaction bottom-tabs";
  await gotoPath(page, baseUrl, "/");

  const tabs = [
    { label: "Resources", expectedPath: "/resources" },
    { label: "Profile", expectedPath: "/profile" },
    { label: "Settings", expectedPath: "/settings" },
    { label: "Home", expectedPath: "/" },
  ];

  for (const tab of tabs) {
    const clicked = await clickFirstVisible(
      page,
      [page.getByRole("button", { name: new RegExp(`^${escapeRegExp(tab.label)}$`, "i") })],
      failures,
      scope,
      `${tab.label} bottom tab`
    );

    if (!clicked) continue;

    const pathname = new URL(page.url()).pathname;
    if (pathname !== tab.expectedPath) {
      addFailure(failures, scope, `Tapping ${tab.label} routed to ${pathname}, expected ${tab.expectedPath}.`);
    }
  }
}

async function runSettingsSmoke(page, baseUrl, failures) {
  const scope = "interaction settings";
  await gotoPath(page, baseUrl, "/settings");

  await clickFirstVisible(
    page,
    [page.getByRole("button", { name: /advanced/i }), page.getByText(/^Advanced$/i)],
    failures,
    scope,
    "Advanced settings row"
  );

  await clickFirstVisible(
    page,
    [page.getByRole("button", { name: /^Support$/i }), page.getByText(/^Support$/i)],
    failures,
    scope,
    "Support settings row"
  );

  const modalText = page.getByText(/How can we help|Support/i).first();
  if (!(await modalText.isVisible().catch(() => false))) {
    addFailure(failures, scope, "Support modal did not open.");
  }

  await clickFirstVisible(
    page,
    [page.getByRole("button", { name: /^Close$/i }), page.getByText(/^Close$/i)],
    failures,
    scope,
    "Support modal close action"
  );

  if (await page.getByText(/How can we help/i).isVisible().catch(() => false)) {
    addFailure(failures, scope, "Support modal did not dismiss after tapping Cancel.");
  }
}

async function runProfileDropdownSmoke(page, baseUrl, failures) {
  const scope = "interaction profile-dropdown";
  await gotoPath(page, baseUrl, "/profile");

  await clickFirstVisible(
    page,
    [page.getByRole("button", { name: /continue as guest/i }), page.getByText(/continue as guest/i)],
    failures,
    scope,
    "Continue as guest profile action",
    true
  );

  const majorInput = page.getByPlaceholder(/Search Green River majors/i).first();
  if (!(await majorInput.isVisible().catch(() => false))) {
    addFailure(failures, scope, "Major SearchableSelect input is not visible.");
    return;
  }

  await majorInput.scrollIntoViewIfNeeded().catch(() => {});
  await majorInput.click();
  await majorInput.fill("Accounting");
  await page.waitForTimeout(400);

  const firstMajorOption = page.getByText(/Accounting/i).first();
  if (!(await firstMajorOption.isVisible().catch(() => false))) {
    addFailure(failures, scope, "Typing into major SearchableSelect did not show matching options.");
  } else {
    await assertDropdownNotClipped(page, failures, scope, firstMajorOption);
    await firstMajorOption.click();
    await waitForAppSettled(page);
  }

  if (await page.getByText(/Scroll to browse all options/i).isVisible().catch(() => false)) {
    addFailure(failures, scope, "Major dropdown remained open after selecting an option.");
  }

  const stateInput = page.getByPlaceholder(/Search states/i).first();
  if (!(await stateInput.isVisible().catch(() => false))) {
    addFailure(failures, scope, "State SearchableSelect input is not visible.");
    return;
  }

  await stateInput.scrollIntoViewIfNeeded().catch(() => {});
  await stateInput.click();
  await stateInput.fill("Wash");
  await page.waitForTimeout(400);

  const washingtonOption = page.getByText(/^Washington$/i).first();
  if (!(await washingtonOption.isVisible().catch(() => false))) {
    addFailure(failures, scope, "Typing into state SearchableSelect did not show Washington.");
  } else {
    await assertDropdownNotClipped(page, failures, scope, washingtonOption);
    await washingtonOption.click();
    await waitForAppSettled(page);
  }
}

async function runResourcesSmoke(page, baseUrl, failures) {
  const scope = "interaction resources";
  await gotoPath(page, baseUrl, "/resources");

  const searchInput = page.locator("input").first();
  if (!(await searchInput.isVisible().catch(() => false))) {
    addFailure(failures, scope, "Resources search input is not visible.");
    return;
  }

  await searchInput.fill("Deadline Calendar");
  await page.waitForTimeout(350);

  const opened = await clickFirstVisible(
    page,
    [page.getByText("Deadline Calendar", { exact: true }), page.getByText(/Deadline Calendar/i)],
    failures,
    scope,
    "Deadline Calendar resource card/link",
    true
  );

  if (opened) {
    const pathname = new URL(page.url()).pathname;
    if (pathname !== "/calendar") {
      addFailure(failures, scope, `Opening Deadline Calendar routed to ${pathname}, expected /calendar.`);
    }
  } else {
    addFailure(failures, scope, "Could not open a Resources card/link.");
  }
}

async function runTransferPlannerSmoke(page, baseUrl, failures) {
  const scope = "interaction transfer-planner";
  await gotoPath(page, baseUrl, "/resources/transfer-planner");

  if (await page.getByText(/Open this as a student profile first/i).isVisible().catch(() => false)) {
    addFailure(failures, scope, "Transfer Planner opened without a guest/student profile.");
    return;
  }

  const plannerTextVisible = await page
    .getByText(/transfer plan|Course Planner|Quarter plan|Choose your plan options/i)
    .first()
    .isVisible()
    .catch(() => false);

  if (!plannerTextVisible) {
    addFailure(failures, scope, "Transfer Planner did not render expected planner content.");
    return;
  }

  const toggle = await findVisibleLocator([
    page.getByRole("checkbox", { name: /Allow summer classes/i }),
    page.getByRole("checkbox", { name: /Allow STEM prep classes/i }),
    page.getByRole("checkbox", { name: /Only show classes/i }),
  ]);

  if (toggle) {
    await toggle.scrollIntoViewIfNeeded().catch(() => {});
    await toggle.click({ timeout: 5000 });
    await waitForAppSettled(page);
    return;
  }

  log("Transfer Planner rendered, but no schedule option toggle was available for this data state; skipped toggle step.");
}

async function runInteractionSmoke(browser, baseUrl, failures) {
  const context = await createMobileContext(browser, {
    width: 390,
    height: 844,
    isMobile: true,
  });
  const page = await context.newPage();

  try {
    await runBottomTabSmoke(page, baseUrl, failures);
    await runSettingsSmoke(page, baseUrl, failures);
    await runProfileDropdownSmoke(page, baseUrl, failures);
    await runResourcesSmoke(page, baseUrl, failures);
    await runTransferPlannerSmoke(page, baseUrl, failures);
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  let serverHandle = null;
  let baseUrl = providedBaseUrl;

  if (!baseUrl) {
    const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
    const port = await findAvailablePort(requestedPort);
    baseUrl = `http://127.0.0.1:${port}`;

    log("Exporting Expo web build for mobile QA...");
    await run(npxCommand, ["expo", "export", "--platform", "web", "--output-dir", ".tools/qa-web"]);

    log(`Serving static QA export at ${baseUrl}...`);
    serverHandle = await createStaticServer(exportDir, port);
  } else {
    log(`Using provided QA_BASE_URL ${baseUrl}.`);
  }

  const failures = [];
  const browser = await chromium.launch({ headless: true });

  try {
    await runScreenshotPass(browser, baseUrl, failures);
    await runInteractionSmoke(browser, baseUrl, failures);
  } finally {
    await browser.close();
    if (serverHandle) {
      await serverHandle.close();
    }
  }

  const reportPath = path.join(outputDir, "mobile-qa-report.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        baseUrl,
        viewports,
        screenshotRoutes,
        failures,
        screenshotsDirectory: outputDir,
      },
      null,
      2
    )
  );

  if (failures.length) {
    console.error(`\n[mobile-qa] ${failures.length} failure${failures.length === 1 ? "" : "s"} found.`);
    console.error(`[mobile-qa] Report written to ${reportPath}`);
    process.exitCode = 1;
    return;
  }

  log(`Passed. Screenshots and report saved to ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
