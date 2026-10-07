// QA do primeiro acesso: senha provisória → configurar autenticador (QR/chave) → senha definitiva → painel.
// Uso: node --env-file=.env.local scripts/qa-first-access.mjs
import puppeteer from "puppeteer-core";
import { TOTP, Secret } from "otpauth";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.QA_BASE || "http://localhost:3100";
const email = `primeiro.${Date.now()}@teste.bora.invalid`;
const out = JSON.parse(execFileSync("node", ["--env-file=.env.local", "scripts/create-member.mjs", email, "Primeiro Acesso", "leitura"]).toString());
const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 860 });
let pass = 0, fail = 0;
const ok = (c, l) => { (c ? pass++ : fail++); console.log(c ? "  ✓" : "  ✗", l); };

await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
await page.type("input[name=email]", email);
await page.type("input[name=password]", out.senha_provisoria);
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button:not([type=button])")]);
ok(page.url().endsWith("/login/autenticador"), "sem autenticador vai para a configuração");
await page.waitForSelector("img[alt^='QR']");
await page.screenshot({ path: ".qa/primeiro-acesso-qr.png" });

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle0" });
ok(page.url().includes("/login"), "painel bloqueado antes de ativar o autenticador");
await page.goto(`${BASE}/login/autenticador`, { waitUntil: "networkidle0" });
await page.waitForSelector("details code");
const secret2 = await page.$eval("details code", (e) => e.textContent.trim());
await page.type("input[name=code]", new TOTP({ secret: Secret.fromBase32(secret2) }).generate());
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button[class*=bg-signal]")]);
ok(page.url().endsWith("/login/nova-senha"), "depois do autenticador pede a senha definitiva"); if (!page.url().endsWith("/login/nova-senha")) { console.log(page.url(), await page.evaluate(() => document.body.innerText.slice(0, 400))); await page.screenshot({ path: ".qa/primeiro-erro.png" }); }
const pw = "Nova-Senha-QA-2026!";
const marked = () => page.$$eval('li span[class*="before:scale-x-100"]', (l) => l.length);
await page.type("input[name=password]", "nova");
ok(await marked() === 1, "guia marca só a minúscula com 'nova'");
await page.$eval("input[name=password]", (e) => { e.value = ""; });
await page.type("input[name=password]", pw);
ok(await marked() === 5, "guia marca as 5 regras com a senha completa");
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: ".qa/nova-senha-guia.png" });
const eye = "input[name=password] + button";
await page.click(eye);
await new Promise((r) => setTimeout(r, 1400));
ok(await page.$eval("input[name=password]", (e, v) => e.type === "text" && e.value === v, pw), "olho revela a senha certa");
await page.screenshot({ path: ".qa/nova-senha-revelada.png" });
await page.click(eye);
await new Promise((r) => setTimeout(r, 1400));
ok(await page.$eval("input[name=password]", (e, v) => e.type === "password" && e.value === v, pw), "olho esconde de novo sem mudar o valor");
await page.type("input[name=again]", pw);
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button:not([type=button])")]);
ok(page.url().endsWith("/builder"), "entra no painel");
const nav = await page.evaluate(() => document.body.innerText);
ok(!nav.includes("Membros") && nav.includes("Cadastros"), "papel Leitura não vê Admin");
await page.goto(`${BASE}/admin/membros`, { waitUntil: "networkidle0" });
ok(page.url().endsWith("/sem-acesso"), "Admin por URL direta cai em sem acesso");

// Segundo acesso: sai e entra de novo. Tem que pedir só o código, sem configurar de novo nem trocar a senha.
await page.goto(`${BASE}/conta`, { waitUntil: "networkidle0" });
await page.evaluate(() => [...document.querySelectorAll("form button")].find((b) => b.title === "Sair" || b.textContent.trim() === "Sair")?.click());
await page.waitForFunction(() => location.pathname === "/login", { timeout: 15000 }).catch(() => {});
await page.type("input[name=email]", email);
await page.type("input[name=password]", pw);
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.keyboard.press("Enter")]);
ok(page.url().endsWith("/login/codigo"), "segundo acesso pede só o código (autenticador ficou salvo)");
await new Promise((r) => setTimeout(r, 31000)); // próximo código de 30 s
await page.type("input[name=code]", new TOTP({ secret: Secret.fromBase32(secret2) }).generate());
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.keyboard.press("Enter")]);
ok(page.url().endsWith("/builder"), "entra direto no painel (senha definitiva ficou salva)");
await page.reload({ waitUntil: "networkidle0" });
ok(page.url().endsWith("/builder"), "recarregar a página mantém a sessão");

const a = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
await a.auth.admin.deleteUser(out.user_id);
console.log(`\n${pass} ok · ${fail} falhas`);
await browser.close();
process.exit(fail ? 1 : 0);
