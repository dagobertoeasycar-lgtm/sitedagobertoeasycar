import { access, appendFile, readFile, unlink, writeFile } from "node:fs/promises";
import http from "node:http";
import { spawn } from "node:child_process";

const logFile = "C:\\Logs\\DagobertoEasycar\\monitor\\healthcheck.log";
const backupLog = "C:\\Logs\\DagobertoEasycar\\monitor\\backup.log";
const backupMarker = "C:\\Logs\\DagobertoEasycar\\monitor\\backup-now";
const backupState = "C:\\Logs\\DagobertoEasycar\\monitor\\last-scheduled-backup.txt";
const intervalMs = 5 * 60 * 1000;
let backupRunning = false;

function requestHealth(port, host) {
  return new Promise((resolve) => {
    const request = http.get({ hostname: "127.0.0.1", port, path: "/api/health", headers: { Host: host }, agent: false, timeout: 8000 }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve(response.statusCode === 200 && body.includes('"status":"ok"') && body.includes('"database":"ok"')));
    });
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", () => resolve(false));
  });
}

async function check() {
  const [direct, iis] = await Promise.all([
    requestHealth(3100, "127.0.0.1"),
    requestHealth(80, "www.dagobertoeasycar.com.br"),
  ]);
  const ok = direct && iis;
  await appendFile(logFile, `${new Date().toISOString()} ${ok ? "OK monitor" : `FALHA monitor direct=${direct} iis=${iis}`}\r\n`, "utf8");
}

function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function runBackup(reason) {
  if (backupRunning) return;
  backupRunning = true;
  await appendFile(backupLog, `${new Date().toISOString()} INICIO monitor reason=${reason}\r\n`, "utf8");
  const exitCode = await new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "C:\\Sites\\DagobertoEasycar\\scripts\\backup.ps1"], { windowsHide: true, stdio: "ignore" });
    child.once("error", () => resolve(255));
    child.once("exit", (code) => resolve(code ?? 255));
  });
  await appendFile(backupLog, `${new Date().toISOString()} ${exitCode === 0 ? "OK" : "FALHA"} monitor exit=${exitCode}\r\n`, "utf8");
  if (exitCode === 0) await writeFile(backupState, localDay(), "utf8");
  backupRunning = false;
}

async function checkBackup() {
  let marker = false;
  try { await access(backupMarker); marker = true; await unlink(backupMarker); } catch {}
  const now = new Date();
  let lastDay = "";
  try { lastDay = (await readFile(backupState, "utf8")).trim(); } catch {}
  const scheduled = now.getHours() === 2 && now.getMinutes() >= 30 && now.getMinutes() < 35 && lastDay !== localDay(now);
  if (marker || scheduled) await runBackup(marker ? "marker" : "schedule");
}

await check().catch(async (error) => {
  await appendFile(logFile, `${new Date().toISOString()} ERRO monitor ${String(error?.message ?? error)}\r\n`, "utf8");
});
await checkBackup();
setInterval(() => { void Promise.all([check(), checkBackup()]); }, intervalMs);
