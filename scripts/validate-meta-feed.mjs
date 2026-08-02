const feedUrl = process.env.META_FEED_URL || "https://www.dagobertoeasycar.com.br/feeds/meta-veiculos.csv";
const concurrency = Math.max(1, Math.min(20, Number(process.env.META_VALIDATE_CONCURRENCY) || 10));

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let i = text.charCodeAt(0) === 0xfeff ? 1 : 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(value); value = ""; }
    else if (char === "\n") {
      row.push(value.replace(/\r$/, ""));
      if (row.some(cell => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

function validPublicHttps(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && host !== "localhost" && host !== "127.0.0.1" && host !== "::1" && !host.endsWith(".local");
  } catch { return false; }
}

async function request(url, expected) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (!response.ok || (expected === "image" && !String(response.headers.get("content-type")).toLowerCase().startsWith("image/"))) {
      response = await fetch(url, { headers: { Range: "bytes=0-1023" }, redirect: "follow", signal: controller.signal });
    }
    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!response.ok) return `HTTP ${response.status}`;
    if (!validPublicHttps(response.url)) return `redirecionou para URL inválida: ${response.url}`;
    if (expected === "image" && !contentType.startsWith("image/")) return `Content-Type ${contentType || "ausente"}`;
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "falha de conexão";
  } finally {
    clearTimeout(timeout);
  }
}

const response = await fetch(feedUrl, { redirect: "follow" });
const contentType = String(response.headers.get("content-type") || "");
if (!response.ok) throw new Error(`Feed retornou HTTP ${response.status}`);
if (!contentType.toLowerCase().startsWith("text/csv")) throw new Error(`Content-Type inválido: ${contentType}`);
if (!validPublicHttps(response.url)) throw new Error(`URL final inválida: ${response.url}`);

const rows = parseCsv(await response.text());
const headers = rows.shift() || [];
const required = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand"];
for (const field of required) if (!headers.includes(field)) throw new Error(`Campo obrigatório ausente: ${field}`);
const index = Object.fromEntries(headers.map((field, position) => [field, position]));
const items = rows.map(row => Object.fromEntries(headers.map((field, position) => [field, row[position] || ""])));

const structuralErrors = [];
const ids = new Set();
const targets = new Map();
for (const item of items) {
  if (!item.id || ids.has(item.id)) structuralErrors.push(`${item.id || "sem ID"}: ID ausente ou duplicado`);
  ids.add(item.id);
  if (!/^\d+\.\d{2} BRL$/.test(item.price)) structuralErrors.push(`${item.id}: preço inválido (${item.price})`);
  if (!validPublicHttps(item.link)) structuralErrors.push(`${item.id}: link inválido`);
  if (!validPublicHttps(item.image_link)) structuralErrors.push(`${item.id}: imagem principal inválida`);
  targets.set(item.link, "page");
  targets.set(item.image_link, "image");
  for (const url of String(item.additional_image_link || "").split(",").map(value => value.trim()).filter(Boolean)) {
    if (!validPublicHttps(url)) structuralErrors.push(`${item.id}: imagem adicional inválida (${url})`);
    else targets.set(url, "image");
  }
}

const queue = [...targets.entries()];
const accessErrors = [];
let checked = 0;
async function worker() {
  while (queue.length) {
    const [url, expected] = queue.shift();
    const error = await request(url, expected);
    if (error) accessErrors.push(`${url} — ${error}`);
    checked++;
    if (checked % 100 === 0) console.log(`Validados ${checked}/${targets.size} recursos`);
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));

const errors = [...structuralErrors, ...accessErrors];
console.log(JSON.stringify({
  feedUrl: response.url,
  status: response.status,
  contentType,
  cacheControl: response.headers.get("cache-control"),
  items: items.length,
  fields: headers.length,
  resourcesChecked: checked,
  errors: errors.length,
  errorSamples: errors.slice(0, 25),
}, null, 2));
if (errors.length) process.exitCode = 1;

