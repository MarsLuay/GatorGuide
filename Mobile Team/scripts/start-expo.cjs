#!/usr/bin/env node

const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const VALID_MODES = ["tunnel", "lan", "offline"];
const DEFAULT_MODE_ORDER = ["tunnel", "lan", "offline"];
const MODE_TIMEOUTS_MS = {
  tunnel: 35000,
  lan: 20000,
  offline: 20000,
};

function log(message) {
  process.stdout.write(`[expo-start] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[expo-start] ${message}\n`);
  process.exit(1);
}

function parseCliArgs(argv) {
  const parsed = {
    web: false,
    dryRun: false,
    forcedMode: "",
    port: "",
    extraExpoArgs: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--web") {
      parsed.web = true;
      continue;
    }

    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }

    if (arg === "--mode" && argv[index + 1]) {
      parsed.forcedMode = String(argv[index + 1] || "");
      index += 1;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      parsed.forcedMode = arg.slice("--mode=".length);
      continue;
    }

    if (arg === "--port" && argv[index + 1]) {
      parsed.port = String(argv[index + 1] || "");
      index += 1;
      continue;
    }

    if (arg.startsWith("--port=")) {
      parsed.port = arg.slice("--port=".length);
      continue;
    }

    parsed.extraExpoArgs.push(arg);
  }

  return parsed;
}

function normalizeModeOrder(rawOrder, forcedMode) {
  if (forcedMode) {
    const normalizedForcedMode = forcedMode.trim().toLowerCase();
    if (!VALID_MODES.includes(normalizedForcedMode)) {
      fail(
        `Unsupported Expo mode "${forcedMode}". Expected one of: ${VALID_MODES.join(
          ", "
        )}.`
      );
    }
    return [normalizedForcedMode];
  }

  const requestedModes = String(rawOrder || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .filter((value) => VALID_MODES.includes(value));

  if (!requestedModes.length) {
    return [...DEFAULT_MODE_ORDER];
  }

  return Array.from(new Set(requestedModes));
}

function resolvePort(cliPort) {
  const raw = String(cliPort || process.env.EXPO_START_PORT || "8081").trim();
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`Invalid Expo port "${raw}".`);
  }
  return parsed;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(1000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPort(port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port)) {
      return true;
    }
    await wait(1000);
  }
  return false;
}

function terminateChild(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode != null) {
      resolve();
      return;
    }

    const finish = () => resolve();
    child.once("exit", finish);

    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        stdio: "ignore",
      });
      killer.once("exit", () => finish());
      return;
    }

    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode == null) {
        child.kill("SIGKILL");
      }
    }, 3000).unref();
  });
}

function buildExpoArgs({ web, port, mode, extraExpoArgs }) {
  const args = ["start"];
  if (web) args.push("--web");
  if (mode === "tunnel") args.push("--tunnel");
  if (mode === "lan") args.push("--lan");
  if (mode === "offline") args.push("--offline");
  args.push("--port", String(port), ...extraExpoArgs);
  return args;
}

async function attemptExpoStart({ mode, web, port, extraExpoArgs }) {
  const localExpoCli = path.join(process.cwd(), "node_modules", "expo", "bin", "cli");
  const command = process.execPath;
  const args = buildExpoArgs({ web, port, mode, extraExpoArgs });
  const env = { ...process.env };

  if (mode === "offline") {
    env.EXPO_OFFLINE = "1";
  } else {
    delete env.EXPO_OFFLINE;
  }

  log(`Trying Expo ${mode} mode on port ${port}${web ? " (web)" : ""}...`);

  const child = spawn(command, [localExpoCli, ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
    env,
  });

  const exitPromise = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

  const readyPromise = waitForPort(port, MODE_TIMEOUTS_MS[mode]).then((ready) => ({
    ready,
  }));

  const result = await Promise.race([exitPromise, readyPromise]);

  if (result && typeof result === "object" && "ready" in result && result.ready) {
    log(`Expo is live in ${mode} mode at http://127.0.0.1:${port}`);
    const exitCode = await new Promise((resolve) => {
      child.once("exit", (code) => resolve(code ?? 0));
    });
    process.exit(Number(exitCode) || 0);
  }

  await terminateChild(child);

  if (result && typeof result === "object" && "code" in result) {
    const detail =
      result.signal != null
        ? `signal ${result.signal}`
        : `exit code ${result.code ?? "unknown"}`;
    log(`Expo ${mode} mode ended before it came online (${detail}).`);
    return false;
  }

  log(`Expo ${mode} mode did not come online in time.`);
  return false;
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const port = resolvePort(cli.port);
  const modes = normalizeModeOrder(
    process.env.GATORGUIDE_EXPO_MODE_ORDER,
    cli.forcedMode
  );

  if (cli.dryRun) {
    log(
      `Dry run: ${cli.web ? "web " : ""}start will try ${modes.join(
        " -> "
      )} on port ${port}.`
    );
    if (cli.extraExpoArgs.length) {
      log(`Extra Expo args: ${cli.extraExpoArgs.join(" ")}`);
    }
    process.exit(0);
  }

  if (await isPortOpen(port)) {
    fail(
      `Port ${port} is already in use. Stop the existing server or set EXPO_START_PORT to another port.`
    );
  }

  for (const mode of modes) {
    const started = await attemptExpoStart({
      mode,
      web: cli.web,
      port,
      extraExpoArgs: cli.extraExpoArgs,
    });
    if (started) {
      return;
    }
  }

  fail(
    `Expo could not start in any configured mode (${modes.join(
      " -> "
    )}).`
  );
}

void main();
