import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import net from "node:net";

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const output = process.argv[2] ?? join(process.cwd(), "validation", "screenshots");
const baseUrl = process.argv[3] ?? process.env.RESPONSIVE_AUDIT_URL ?? "http://127.0.0.1:3100";
const paths = (process.argv[4] ?? process.env.RESPONSIVE_AUDIT_PATHS ?? "/")
  .split(",")
  .map((path) => path.trim())
  .filter(Boolean);
const widths = (process.argv[5] ?? process.env.RESPONSIVE_AUDIT_WIDTHS ?? "")
  .split(",")
  .map((width) => Number.parseInt(width.trim(), 10))
  .filter((width) => Number.isInteger(width) && width > 0);
if (!widths.length) widths.push(320, 360, 375, 390, 412, 768, 1024, 1366, 1440, 1920);

function urlFor(path) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path, normalizedBase).toString();
}

function slugFor(path) {
  return path.replace(/(^\/|[^\w-]+)/g, "-").replace(/^-+|-+$/g, "") || "home";
}

async function freePort() {
  return await new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

async function waitForJson(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error(`Edge CDP indisponivel em ${url}`);
}

class Cdp {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener("open", resolveOpen, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) {
        const listeners = this.listeners.get(message.method) ?? [];
        for (const listener of listeners) listener(message);
        return;
      }
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  close() { this.socket.close(); }
}

await mkdir(output, { recursive: true });
const port = await freePort();
const profile = resolve(tmpdir(), `dagoberto-edge-${process.pid}-${Date.now()}`);
const allowedPrefix = resolve(tmpdir()) + sep + "dagoberto-edge-";
if (!profile.startsWith(allowedPrefix)) throw new Error("Perfil temporario fora da raiz permitida");

const browser = spawn(edge, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--host-resolver-rules=MAP www.dagobertoeasycar.com.br 127.0.0.1",
  "about:blank",
], { windowsHide: true, stdio: "ignore" });

let cdp;
try {
  await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" }).then((response) => response.json());
  cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const results = [];
  let pageIssues = [];
  cdp.on("Runtime.consoleAPICalled", (message) => {
    if (message.params?.type !== "error") return;
    const args = message.params.args?.map((arg) => arg.value ?? arg.description ?? arg.type).join(" ") ?? "console.error";
    pageIssues.push(args);
  });
  cdp.on("Runtime.exceptionThrown", (message) => {
    pageIssues.push(message.params?.exceptionDetails?.text ?? "runtime exception");
  });

  for (const path of paths) {
    for (const width of widths) {
      pageIssues = [];
      const height = width <= 412 ? 1000 : 900;
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 412 });
      await cdp.send("Page.navigate", { url: urlFor(path) });
      for (let attempt = 0; attempt < 100; attempt++) {
        const state = await cdp.send("Runtime.evaluate", { expression: "document.readyState", returnByValue: true });
        if (state.result.value === "complete") break;
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
      const audit = await cdp.send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => {
          const doc = document.documentElement;
          const offenders = [...document.querySelectorAll('body *')].map((element) => {
            const rect = element.getBoundingClientRect();
            return { tag: element.tagName, className: String(element.className || '').slice(0, 100), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
          }).filter((item) => item.width > 0 && (item.left < -1 || item.right > innerWidth + 1)).slice(0, 20);
          return { innerWidth, scrollWidth: doc.scrollWidth, bodyScrollWidth: document.body.scrollWidth, title: document.title, offenders };
        })()`
      });
      const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      await writeFile(join(output, `${slugFor(path)}-${width}.png`), Buffer.from(screenshot.data, "base64"));
      results.push({ path, width, ...audit.result.value, consoleErrors: pageIssues.slice(0, 10) });
    }
  }
  await writeFile(join(output, "responsive-audit.json"), JSON.stringify(results, null, 2), "utf8");
  console.log(JSON.stringify(results, null, 2));
} finally {
  try { cdp?.close(); } catch {}
  try { browser.kill("SIGKILL"); } catch {}
  await new Promise((resolveWait) => setTimeout(resolveWait, 600));
  if (!profile.startsWith(allowedPrefix)) throw new Error("Limpeza temporaria recusada");
  const cleanup = async () => {
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  };
  const cleanupTimedOut = await Promise.race([
    cleanup().then(() => false).catch((error) => {
      console.warn(`Aviso: perfil temporario do Edge nao foi removido automaticamente (${error.code ?? "erro desconhecido"}).`);
      return false;
    }),
    new Promise((resolveWait) => setTimeout(() => resolveWait(true), 2500)),
  ]);
  if (cleanupTimedOut) console.warn("Aviso: limpeza do perfil temporario do Edge excedeu o tempo limite.");
}

process.exit(0);
