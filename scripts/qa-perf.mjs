// Mede a troca de tela dentro do sistema (clique no menu até o conteúdo novo aparecer).
// Uso: QA_BASE=… QA_EMAIL=… QA_PASSWORD=… QA_TOTP=… node scripts/qa-perf.mjs
import puppeteer from "puppeteer-core";
import { TOTP, Secret } from "otpauth";
const BASE = process.env.QA_BASE || "http://localhost:3301";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
await p.type("input[name=email]", process.env.QA_EMAIL);
await p.type("input[name=password]", process.env.QA_PASSWORD);
await Promise.all([p.waitForNavigation(), p.keyboard.press("Enter")]);
await p.type("input[name=code]", new TOTP({ secret: Secret.fromBase32(process.env.QA_TOTP) }).generate());
await Promise.all([p.waitForNavigation({ waitUntil: "networkidle0" }), p.keyboard.press("Enter")]);
const route = ["Cadastros", "Indicações", "Origem", "Cidades", "Qualificação", "Painel", "Cadastros", "Painel"];
const times = [];
for (const label of route) {
  const t0 = Date.now();
  await p.evaluate((l) => [...document.querySelectorAll("aside a")].find((a) => a.textContent.trim() === l)?.click(), label);
  await p.waitForFunction((l) => document.querySelector("main h1")?.closest("main") && document.title.length && [...document.querySelectorAll("aside a[class*='bg-surface-2']")].some((a) => a.textContent.trim() === l) && !document.querySelector("[data-loading]"), { timeout: 30000 }, label);
  await p.waitForNetworkIdle({ idleTime: 150, timeout: 30000 }).catch(() => {});
  const ms = Date.now() - t0; times.push(ms); console.log(label.padEnd(14), ms, "ms");
}
console.log("média", Math.round(times.reduce((a, c) => a + c, 0) / times.length), "ms");
await b.close();
