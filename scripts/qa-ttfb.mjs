// Tempo de resposta do servidor (TTFB) por tela, logado. Média de 3 cargas por tela.
import puppeteer from "puppeteer-core";
import { TOTP, Secret } from "otpauth";
const BASE = process.env.QA_BASE || "http://localhost:3301";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const p = await b.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
await p.type("input[name=email]", process.env.QA_EMAIL); await p.type("input[name=password]", process.env.QA_PASSWORD);
await Promise.all([p.waitForNavigation(), p.keyboard.press("Enter")]);
await p.type("input[name=code]", new TOTP({ secret: Secret.fromBase32(process.env.QA_TOTP) }).generate());
await Promise.all([p.waitForNavigation({ waitUntil: "networkidle0" }), p.keyboard.press("Enter")]);
let all = [];
for (const path of ["/builder", "/builder/cadastros", "/builder/indicacoes", "/builder/cidades", "/admin/membros"]) {
  const t = [];
  for (let i = 0; i < 3; i++) { await p.goto(BASE + path, { waitUntil: "domcontentloaded" }); t.push(await p.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return Math.round(n.responseStart - n.requestStart); })); }
  const avg = Math.round(t.reduce((a, c) => a + c, 0) / t.length); all.push(avg); console.log(path.padEnd(22), avg, "ms");
}
console.log("média", Math.round(all.reduce((a, c) => a + c, 0) / all.length), "ms");
await b.close();
