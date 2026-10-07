// QA dos fluxos que gravam: revelar contato, nota, editar, publicar SEO, criar chave MCP, criar membro, exportar.
// Uso: QA_EMAIL=… QA_PASSWORD=… QA_TOTP=… QA_LEAD=<id> QA_PAGE=<id da página "/"> node scripts/qa-flow.mjs
import puppeteer from "puppeteer-core";
import { TOTP, Secret } from "otpauth";

const BASE = process.env.QA_BASE || "http://localhost:3100";
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on("dialog", (d) => d.accept());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let pass = 0, fail = 0;
const ok = (c, l) => { (c ? pass++ : fail++); console.log(c ? "  ✓" : "  ✗", l); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = async (text, tag = "button") => {
  const h = await page.waitForFunction((t, tg) => [...document.querySelectorAll(tg)].find((b) => b.textContent.trim().includes(t) && !b.disabled), { timeout: 8000 }, text, tag);
  await h.asElement().click();
};
const bodyHas = (t) => page.evaluate((x) => document.body.innerText.includes(x), t);
const waitText = async (t, timeout = 10000) => { try { await page.waitForFunction((x) => document.body.innerText.includes(x), { timeout }, t); return true; } catch { return false; } };

await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
await page.type("input[name=email]", process.env.QA_EMAIL);
await page.type("input[name=password]", process.env.QA_PASSWORD);
await Promise.all([page.waitForNavigation(), page.click("button:not([type=button])")]);
await page.type("input[name=code]", new TOTP({ secret: Secret.fromBase32(process.env.QA_TOTP) }).generate());
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button[class*=bg-signal]")]);
ok(page.url().endsWith("/builder"), "login com senha + autenticador");

console.log("Cadastro");
await page.goto(`${BASE}/builder/cadastros?id=${process.env.QA_LEAD}`, { waitUntil: "networkidle0" });
const masked = await page.evaluate(() => [...document.querySelectorAll("aside")].pop()?.innerText.includes("•••"));
ok(masked, "ficha abre com contato mascarado");
await clickText("revelar");
ok(await waitText("Revelação registrada"), "revelar mostra o contato e avisa do registro");
await page.type("aside input[placeholder^='Registrar contato']", "Ligação de teste do QA");
await clickText("Salvar");
ok(await waitText("Ligação de teste do QA"), "nota salva aparece na ficha");
await clickText("Editar");
await page.waitForSelector("input[name=first_name]");
await page.$eval("input[name=first_name]", (e) => { e.value = ""; });
await page.type("input[name=first_name]", "Larissa QA");
await clickText("Salvar", "button[class*=bg-signal]");
await sleep(1500);
ok(await waitText("Larissa QA"), "edição salva");
await clickText("Histórico");
ok(await waitText("Alterado"), "histórico mostra a alteração");

console.log("Conteúdo e SEO");
await page.goto(`${BASE}/builder/conteudo/${process.env.QA_PAGE}`, { waitUntil: "networkidle0" });
const t = await page.$("input[placeholder^='BORA na sua cidade · BORA']");
await t.type("Teste QA · BORA na sua cidade");
await clickText("Publicar");
ok(await waitText("Publicado"), "publicar cria versão e tenta avisar a LP");
ok(await page.waitForFunction(() => /no ar: v\d/i.test(document.body.innerText), { timeout: 10000 }).then(() => true, () => false), "versão aparece como no ar");

console.log("MCP");
await page.goto(`${BASE}/mcp`, { waitUntil: "networkidle0" });
await page.type("form input[minlength='2']", "QA navegador");
await clickText("Criar chave");
ok(await waitText("Copie agora"), "chave criada e mostrada uma vez");
const token = await page.evaluate(() => document.querySelector("code")?.textContent ?? "");
ok(/^bos_/.test(token), "formato da chave");

console.log("Admin");
await page.goto(`${BASE}/admin/membros`, { waitUntil: "networkidle0" });
await page.type("input[name=full_name]", "Comercial Teste QA");
await page.type("input[name=email]", `comercial.qa.${Date.now()}@teste.bora.invalid`);
await page.select("select", "comercial");
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "GO")?.click());
await clickText("Criar acesso");
ok(await waitText("Senha provisória"), "membro criado com senha provisória");

console.log("Exportação");
await page.goto(`${BASE}/builder/cadastros?uf=GO`, { waitUntil: "networkidle0" });
const cdp = await page.createCDPSession();
await cdp.send("Browser.setDownloadBehavior", { behavior: "deny" });
await clickText("Exportar");
ok(await waitText("linhas exportadas"), "exportação gera CSV e avisa do registro");

console.log("Auditoria");
await page.goto(`${BASE}/admin/auditoria`, { waitUntil: "networkidle0" });
ok(await bodyHas("revelou contato") && await bodyHas("exportou cadastros") && await bodyHas("versão de página"), "auditoria registra revelação, exportação e publicação");

console.log(`\n${pass} ok · ${fail} falhas`);
if (errors.length) console.log("erros de página:", [...new Set(errors)].join("\n"));
await browser.close();
process.exit(fail ? 1 : 0);
