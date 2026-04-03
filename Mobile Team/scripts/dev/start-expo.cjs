#!/usr/bin/env node

const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");
const {
  runRepoHealthCheck,
  printRepoHealthCheck,
} = require("./repo-health-check.cjs");

const OUTPUT_BRIDGE_ENV = "GATORGUIDE_EXPO_OUTPUT_BRIDGE";
const OUTPUT_BRIDGE_FILE_ENV = "GATORGUIDE_EXPO_OUTPUT_FILE";
const VALID_MODES = ["tunnel", "lan", "offline"];
const DEFAULT_MODE_ORDER = ["tunnel", "lan", "offline"];
const MODE_TIMEOUTS_MS = {
  tunnel: 35000,
  lan: 20000,
  offline: 20000,
};
const READY_STABILITY_DELAY_MS = 2500;
const TUNNEL_SUCCESS_PATTERNS = ["tunnel ready.", "tunnel connected."];
const TUNNEL_FAILURE_PATTERNS = [
  "ngrok tunnel took too long to connect.",
  "tunnel connection has been closed.",
  "cannot start tunnel url",
  "cannot use ngrok with a robot user.",
];
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const OUTPUT_BRIDGE_POLL_MS = 150;

function log(message) {
  process.stdout.write(`[expo-start] ${message}\n`);
}

function fail(message) {
  process.stderr.write(`[expo-start] ${message}\n`);
  process.exit(1);
}

function stripAnsi(value) {
  return String(value || "").replace(ANSI_ESCAPE_PATTERN, "");
}

function toText(chunk, encoding) {
  if (typeof chunk === "string") {
    return chunk;
  }

  if (Buffer.isBuffer(chunk)) {
    return chunk.toString(typeof encoding === "string" ? encoding : "utf8");
  }

  if (chunk == null) {
    return "";
  }

  return String(chunk);
}

function createLineForwarder(streamName, stream) {
  const originalWrite = stream.write.bind(stream);
  let buffer = "";
  const bridgeOutputFile = String(process.env[OUTPUT_BRIDGE_FILE_ENV] || "").trim();

  const sendLine = (line) => {
    if (!bridgeOutputFile) {
      return;
    }

    try {
      fs.appendFileSync(bridgeOutputFile, `${JSON.stringify({
        stream: streamName,
        line,
      })}\n`);
    } catch (error) {
      // Ignore output bridge write errors and continue writing to the terminal.
    }
  };

  const flushCompleteLines = () => {
    let index = 0;

    while (index < buffer.length) {
      const char = buffer[index];
      if (char !== "\n" && char !== "\r") {
        index += 1;
        continue;
      }

      const line = buffer.slice(0, index);
      sendLine(line);

      let nextIndex = index + 1;
      if (char === "\r" && buffer[nextIndex] === "\n") {
        nextIndex += 1;
      }

      buffer = buffer.slice(nextIndex);
      index = 0;
    }
  };

  const flushRemainder = () => {
    if (!buffer) {
      return;
    }

    sendLine(buffer);
    buffer = "";
  };

  stream.write = function patchedWrite(chunk, encoding, callback) {
    const text = toText(chunk, encoding);
    if (text) {
      buffer += text;
      flushCompleteLines();
    }

    return originalWrite(chunk, encoding, callback);
  };

  return flushRemainder;
}

function installOutputBridge() {
  const flushers = [
    createLineForwarder("stdout", process.stdout),
    createLineForwarder("stderr", process.stderr),
  ];

  const flushAll = () => {
    for (const flush of flushers) {
      try {
        flush();
      } catch (error) {
        // Ignore flush errors during shutdown.
      }
    }
  };

  process.on("beforeExit", flushAll);
  process.on("exit", flushAll);
  process.on("SIGINT", flushAll);
  process.on("SIGTERM", flushAll);
}

function quoteNodeOptionValue(value) {
  return `"${String(value || "").replace(/(["\\])/g, "\\$1")}"`;
}

function buildNodeOptionsWithRequire(existingNodeOptions, requirePath) {
  const requireOption = `--require ${quoteNodeOptionValue(requirePath)}`;
  return String(existingNodeOptions || "").trim()
    ? `${String(existingNodeOptions || "").trim()} ${requireOption}`
    : requireOption;
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

function createOutputTracker() {
  let lastErrorLine = "";
  let lastCommandErrorLine = "";

  return {
    pushLine(line, isErrorStream) {
      const normalizedLine = stripAnsi(line).trim();
      if (!normalizedLine) {
        return;
      }

      if (isErrorStream) {
        lastErrorLine = normalizedLine;
      }

      if (/^commanderror:/i.test(normalizedLine)) {
        lastCommandErrorLine = normalizedLine;
      }
    },
    getFailureReason() {
      return lastCommandErrorLine || lastErrorLine || "";
    },
  };
}

function createTunnelStatusMonitor(timeoutMs) {
  let settled = false;
  let resolveStatus = () => {};

  const promise = new Promise((resolve) => {
    resolveStatus = resolve;
  });

  const settle = (status) => {
    if (settled) {
      return;
    }

    settled = true;
    clearTimeout(timeoutId);
    resolveStatus(status);
  };

  const timeoutId = setTimeout(() => {
    settle({
      ready: false,
      reason: "Tunnel mode did not report ready in time.",
    });
  }, timeoutMs);

  return {
    promise,
    pushLine(line) {
      const normalizedLine = stripAnsi(line).trim().toLowerCase();
      if (!normalizedLine) {
        return;
      }

      if (normalizedLine.startsWith("commanderror:")) {
        settle({
          ready: false,
          reason: stripAnsi(line).trim(),
        });
        return;
      }

      if (
        TUNNEL_SUCCESS_PATTERNS.some((pattern) =>
          normalizedLine.includes(pattern)
        )
      ) {
        settle({ ready: true });
        return;
      }

      const failurePattern = TUNNEL_FAILURE_PATTERNS.find((pattern) =>
        normalizedLine.includes(pattern)
      );
      if (failurePattern) {
        settle({
          ready: false,
          reason: stripAnsi(line).trim(),
        });
      }
    },
  };
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

function resolveNpxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function quoteShellArg(value) {
  const text = String(value ?? "");
  if (process.platform !== "win32") {
    if (!text) {
      return "''";
    }
    return "'" + text.replace(/'/g, "'\"'\"'") + "'";
  }

  if (!text) {
    return '""';
  }

  if (/^[A-Za-z0-9_./:=@+-]+$/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function buildExpoArgs({ web, port, mode, extraExpoArgs }) {
  const args = ["start"];
  if (web) args.push("--web");
  if (mode === "tunnel") args.push("--tunnel");
  if (mode === "offline") args.push("--offline");
  args.push("--port", String(port), ...extraExpoArgs);
  return args;
}

function spawnExpoProcess({ args, env }) {
  if (process.platform === "win32") {
    const commandLine = ["npx", "expo", ...args].map(quoteShellArg).join(" ");
    return spawn("cmd.exe", ["/d", "/s", "/c", commandLine], {
      cwd: process.cwd(),
      stdio: "inherit",
      env,
    });
  }

  return spawn(resolveNpxCommand(), ["expo", ...args], {
    cwd: process.cwd(),
    stdio: "inherit",
    env,
  });
}

function createOutputBridgeTail(filePath, onLine) {
  let offset = 0;
  let buffer = "";

  const poll = () => {
    try {
      if (!fs.existsSync(filePath)) {
        return;
      }

      const stats = fs.statSync(filePath);
      if (stats.size <= offset) {
        return;
      }

      const length = stats.size - offset;
      const fileHandle = fs.openSync(filePath, "r");
      const chunk = Buffer.alloc(length);

      try {
        const bytesRead = fs.readSync(fileHandle, chunk, 0, length, offset);
        offset += bytesRead;
        buffer += chunk.toString("utf8", 0, bytesRead);
      } finally {
        fs.closeSync(fileHandle);
      }

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const rawLine = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (rawLine) {
          try {
            const event = JSON.parse(rawLine);
            onLine(String(event.line || ""), event.stream === "stderr");
          } catch (error) {
            // Ignore malformed bridge lines.
          }
        }

        newlineIndex = buffer.indexOf("\n");
      }
    } catch (error) {
      // Ignore bridge tail errors and continue monitoring.
    }
  };

  const intervalId = setInterval(poll, OUTPUT_BRIDGE_POLL_MS);
  if (typeof intervalId.unref === "function") {
    intervalId.unref();
  }

  return {
    stop() {
      clearInterval(intervalId);
      poll();

      const trailingLine = buffer.trim();
      if (!trailingLine) {
        return;
      }

      try {
        const event = JSON.parse(trailingLine);
        onLine(String(event.line || ""), event.stream === "stderr");
      } catch (error) {
        // Ignore malformed trailing bridge data.
      }
    },
  };
}

async function attemptExpoStart({ mode, web, port, extraExpoArgs }) {
  const args = buildExpoArgs({ web, port, mode, extraExpoArgs });
  const outputBridgeFilePath = path.join(
    process.cwd(),
    ".expo",
    `start-expo-bridge-${mode}-${process.pid}.log`
  );
  const env =
    mode === "tunnel"
      ? {
          ...process.env,
          [OUTPUT_BRIDGE_ENV]: "1",
          [OUTPUT_BRIDGE_FILE_ENV]: outputBridgeFilePath,
          NODE_OPTIONS: buildNodeOptionsWithRequire(process.env.NODE_OPTIONS, __filename),
        }
      : { ...process.env };

  if (mode === "offline") {
    env.EXPO_OFFLINE = "1";
  } else {
    delete env.EXPO_OFFLINE;
  }

  log(`Trying Expo ${mode} mode on port ${port}${web ? " (web)" : ""}...`);

  if (mode === "tunnel") {
    try {
      fs.mkdirSync(path.dirname(outputBridgeFilePath), { recursive: true });
      fs.writeFileSync(outputBridgeFilePath, "");
    } catch (error) {
      // Ignore bridge file prep failures and continue startup.
    }
  }

  const child = spawnExpoProcess({ args, env });

  const outputTracker = createOutputTracker();
  const tunnelMonitor =
    mode === "tunnel" ? createTunnelStatusMonitor(MODE_TIMEOUTS_MS[mode]) : null;
  const outputBridgeTail =
    mode === "tunnel"
      ? createOutputBridgeTail(outputBridgeFilePath, (line, isErrorStream) => {
          outputTracker.pushLine(line, isErrorStream);
          tunnelMonitor?.pushLine(line);
        })
      : null;

  const closePromise = new Promise((resolve) => {
    child.once("close", (code, signal) => {
      outputBridgeTail?.stop();
      resolve({ type: "exit", code, signal });
    });
  });

  const spawnErrorPromise = new Promise((resolve) => {
    child.once("error", (error) => {
      outputBridgeTail?.stop();
      resolve({
        type: "spawn-error",
        reason: error instanceof Error ? error.message : String(error),
      });
    });
  });

  const startupChecks = [
    waitForPort(port, MODE_TIMEOUTS_MS[mode]).then((ready) => {
      if (!ready) {
        throw new Error(`Expo ${mode} mode did not open port ${port} in time.`);
      }
    }),
  ];

  if (tunnelMonitor) {
    startupChecks.push(
      tunnelMonitor.promise.then((status) => {
        if (!status.ready) {
          throw new Error(status.reason || "Tunnel mode failed to connect.");
        }
      })
    );
  }

  const readyPromise = Promise.all(startupChecks)
    .then(() => ({ type: "ready" }))
    .catch((error) => ({
      type: "startup-failed",
      reason: error instanceof Error ? error.message : String(error),
    }));

  const result = await Promise.race([closePromise, spawnErrorPromise, readyPromise]);

  if (result && typeof result === "object" && result.type === "ready") {
    const stabilityResult = await Promise.race([
      closePromise,
      wait(READY_STABILITY_DELAY_MS).then(() => ({ type: "stable" })),
    ]);

    if (
      stabilityResult &&
      typeof stabilityResult === "object" &&
      stabilityResult.type === "exit"
    ) {
      const detail =
        stabilityResult.signal != null
          ? `signal ${stabilityResult.signal}`
          : `exit code ${stabilityResult.code ?? "unknown"}`;
      log(`Expo ${mode} mode ended during startup verification (${detail}).`);
      return false;
    }

    log(`Expo is live in ${mode} mode at http://127.0.0.1:${port}`);
    const exitResult = await closePromise;
    process.exit(Number(exitResult.code) || 0);
  }

  await terminateChild(child);

  if (result && typeof result === "object" && result.type === "spawn-error") {
    log(
      result.reason
        ? `Expo ${mode} mode could not launch: ${result.reason}`
        : `Expo ${mode} mode could not launch.`
    );
    return false;
  }

  if (result && typeof result === "object" && result.type === "exit") {
    const failureReason = outputTracker.getFailureReason();
    const detail =
      result.signal != null
        ? `signal ${result.signal}`
        : `exit code ${result.code ?? "unknown"}`;
    if (failureReason) {
      log(`Expo ${mode} mode failed before it came online: ${failureReason}`);
    } else {
      log(`Expo ${mode} mode ended before it came online (${detail}).`);
    }
    return false;
  }

  log(
    result.reason
      ? `Expo ${mode} mode failed before it came online: ${result.reason}`
      : `Expo ${mode} mode did not come online in time.`
  );
  return false;
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2));
  const port = resolvePort(cli.port);
  const modes = normalizeModeOrder(
    process.env.GATORGUIDE_EXPO_MODE_ORDER,
    cli.forcedMode
  );

  if (process.env.GATORGUIDE_SKIP_HEALTH_CHECK !== "1") {
    const healthResult = runRepoHealthCheck();
    if (!healthResult.ok) {
      printRepoHealthCheck(healthResult);
      fail(
        "Repo health check failed. Fix the issues above or rerun with GATORGUIDE_SKIP_HEALTH_CHECK=1 to bypass."
      );
    }
  }

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

if (process.env[OUTPUT_BRIDGE_ENV] === "1" && require.main !== module) {
  installOutputBridge();
} else {
  void main();
}
