#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
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
const requestedPort = Number.parseInt(process.env.QA_BASE_PORT || "4173", 10);

function log(message) {
  process.stdout.write(`[windows-qa-ci] ${message}\n`);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child =
      process.platform === "win32"
        ? spawn(command, args, {
            cwd: options.cwd || rootDir,
            stdio: "inherit",
            env: { ...process.env, ...(options.env || {}) },
            shell: true,
          })
        : spawn(command, args, {
            cwd: options.cwd || rootDir,
            stdio: "inherit",
            env: { ...process.env, ...(options.env || {}) },
          });

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

  throw new Error(
    `Could not find an open localhost QA port starting at ${startPort}.`
  );
}

function createStaticServer(directory, listenPort) {
  const sockets = new Set();
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", `http://127.0.0.1:${listenPort}`);
    const pathname = decodeURIComponent(requestUrl.pathname);

    const candidateRelativePaths = [];
    if (pathname === "/") {
      candidateRelativePaths.push("/index.html");
    } else {
      candidateRelativePaths.push(pathname);
      if (!path.extname(pathname)) {
        candidateRelativePaths.push(`${pathname}.html`);
        candidateRelativePaths.push(path.posix.join(pathname, "index.html"));
      }
    }

    const filePath = candidateRelativePaths
      .map((relativePath) => path.normalize(path.join(directory, relativePath)))
      .find(
        (candidatePath) =>
          candidatePath.startsWith(directory) &&
          fs.existsSync(candidatePath) &&
          fs.statSync(candidatePath).isFile()
      );

    if (!filePath) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    if (!filePath.startsWith(directory)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
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
        server,
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

async function main() {
  const npxCommand = "npx";
  const nodeCommand = "node";
  const port = await findAvailablePort(requestedPort);
  const baseUrl = `http://127.0.0.1:${port}`;
  const phase = String(process.env.QA_WINDOWS_PHASE || "all").trim().toLowerCase();
  const qaEnv = {
    QA_BASE_URL: baseUrl,
    QA_STATIC_EXPORT: "1",
    QA_OUTPUT_SUFFIX: process.env.QA_OUTPUT_SUFFIX || "ci",
  };

  log("Exporting Expo web build for QA...");
  await run(npxCommand, ["expo", "export", "--platform", "web", "--output-dir", ".tools/qa-web"]);

  log(`Serving static QA export at ${baseUrl}...`);
  const staticServer = await createStaticServer(exportDir, port);

  try {
    if (phase === "all" || phase === "screenshots") {
      log("Running Windows screenshot harness...");
      await run(nodeCommand, [".tools/windows-qa.mjs"], { env: qaEnv });
    }

    if (phase === "all" || phase === "interactions") {
      log("Running Windows interaction harness...");
      await run(nodeCommand, [".tools/windows-interactions.mjs"], { env: qaEnv });
    }
  } finally {
    await staticServer.close();
  }

  log("Windows QA finished successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
