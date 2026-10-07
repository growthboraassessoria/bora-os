// QA visual: entra com o membro de teste (senha + TOTP) e captura telas nos dois temas.
// Uso: QA_EMAIL=... QA_PASSWORD=... QA_TOTP=<segredo base32> node scripts/qa-ui.mjs /builder /builder/cadastros ...
import puppeteer from "puppeteer-core";
import { TOTP, Secret } from "otpauth";
import { mkdirSync } from "node:fs";

const BASE = process.env.QA_BASE || "http://localhost:3000";
const OUT = process.env.QA_OUT || "./.qa";
const W = Number(process.env.QA_W || 1440), H = Number(process.env.QA_H || 900);
const themes = (process.env.QA_THEMES || "dark").split(",");
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: [`--window-size=${W},${H}`] });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: process.env.QA_MOBILE ? 3 : 1, isMobile: !!process.env.QA_MOBILE, hasTouch: !!process.env.QA_MOBILE });
if (process.env.QA_MOBILE) await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console ${m.text()}`));
page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
if (process.env.QA_SHOT_LOGIN) await page.screenshot({ path: `${OUT}/login.png` });
await page.type("input[name=email]", process.env.QA_EMAIL);
await page.type("input[name=password]", process.env.QA_PASSWORD);
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button:not([type=button])")]);
if (process.env.QA_SHOT_LOGIN) await page.screenshot({ path: `${OUT}/codigo.png` });
const code = new TOTP({ secret: Secret.fromBase32(process.env.QA_TOTP) }).generate();
await page.type("input[name=code]", code);
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.keyboard.press("Enter")]);
console.log("logado em", page.url());

for (const theme of themes) {
  await page.setCookie({ name: "bos_theme", value: theme, url: BASE });
  for (const path of process.argv.slice(2)) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 400));
    const name = `${theme}-${path.replace(/[/?=&]+/g, "_").replace(/^_/, "") || "home"}.png`;
    await page.screenshot({ path: `${OUT}/${name}`, fullPage: !!process.env.QA_FULL });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(path, theme, overflow ? "ESTOURO HORIZONTAL" : "ok");
  }
}
if (errors.length) console.log("erros:\n" + [...new Set(errors)].join("\n"));
await browser.close();
