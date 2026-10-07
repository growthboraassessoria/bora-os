"use server";
// Ações da tela de Cadastros. O banco confere permissão e escopo; aqui entram a confirmação extra (step-up) e a validação.
import { revalidatePath } from "next/cache";
import { actionAuth, assertStepUp } from "@/lib/auth";
import { rpc, type LeadDetail } from "@/lib/builder";
import { fail, type ActionResult } from "@/lib/errors";
import { resolveCep } from "@/lib/cep";

export async function revealLead(id: string): Promise<ActionResult<Pick<LeadDetail, "email" | "phone" | "phone2" | "cpf" | "birth_date">>> {
  try {
    const a = await actionAuth("builder.leads.pii");
    const d = await rpc<LeadDetail>(a.db, "get_lead", { p_id: id, p_reveal: true });
    return { ok: true, data: { email: d.email, phone: d.phone, phone2: d.phone2 ?? null, cpf: d.cpf, birth_date: d.birth_date } };
  } catch (e) {
    return fail(e);
  }
}

const EDITABLE = ["first_name", "last_name", "email", "phone", "phone2", "cpf", "birth_date", "sex", "cep", "marketing_consent", "instagram", "bio", "public_profile", "public_whatsapp"] as const;

export async function updateLead(id: string, patch: Record<string, string | boolean>): Promise<ActionResult> {
  try {
    const a = await actionAuth("builder.leads.edit");
    const p: Record<string, string | boolean> = {};
    for (const k of EDITABLE) if (k in patch) p[k] = patch[k];
    if (!Object.keys(p).length) return { ok: true };
    await rpc(a.db, "update_lead", { p_id: id, p });
    revalidatePath("/builder/cadastros");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addNote(id: string, body: string): Promise<ActionResult> {
  try {
    const a = await actionAuth("builder.leads.edit");
    if (!body.trim()) return { ok: false, error: "Escreva a nota." };
    await rpc(a.db, "add_note", { p_lead: id, p_body: body.slice(0, 4000) });
    revalidatePath("/builder/cadastros");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setTags(id: string, tags: string[]): Promise<ActionResult> {
  try {
    const a = await actionAuth("builder.leads.edit");
    await rpc(a.db, "set_tags", { p_lead: id, p_tags: tags.map((t) => t.trim()).filter(Boolean).slice(0, 20) });
    revalidatePath("/builder/cadastros");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function anonymizeLead(id: string): Promise<ActionResult> {
  try {
    await actionAuth("builder.leads.anonymize");
    const a = await assertStepUp();
    await rpc(a.db, "anonymize_lead", { p_id: id });
    revalidatePath("/builder/cadastros");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const CSV_COLS: [string, (r: Record<string, unknown>) => unknown][] = [
  ["bora_id", (r) => r.bora_number],
  ["nome", (r) => r.first_name],
  ["sobrenome", (r) => r.last_name],
  ["email", (r) => r.email],
  ["telefone", (r) => r.phone],
  ["cidade", (r) => r.city],
  ["uf", (r) => r.state],
  ["cep", (r) => r.cep],
  ["codigo_indicacao", (r) => r.referral_code],
  ["indicado_por", (r) => r.referred_by],
  ["indicacoes_diretas", (r) => r.direct],
  ["utm_source", (r) => (r.utm as Record<string, unknown>)?.source],
  ["utm_medium", (r) => (r.utm as Record<string, unknown>)?.medium],
  ["utm_campaign", (r) => (r.utm as Record<string, unknown>)?.campaign],
  ["consentimento_marketing", (r) => (r.marketing_consent ? "sim" : "não")],
  ["fundador", (r) => (r.founder ? "sim" : "não")],
  ["origem", (r) => r.source],
  ["criado_em", (r) => r.created_at],
];

function csvCell(v: unknown) {
  if (v == null) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita fórmula ao abrir no Excel/Sheets
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exporta o filtro atual (até 10 mil linhas). Exige confirmação recente do autenticador e fica na auditoria. */
export async function exportLeads(filters: Record<string, unknown>): Promise<ActionResult<{ csv: string; rows: number; pii: boolean }>> {
  try {
    await actionAuth("builder.leads.export");
    const a = await assertStepUp();
    const rows: Record<string, unknown>[] = [];
    let pii = false;
    for (let offset = 0; offset < 10_000; offset += 500) {
      const res = await rpc<{ rows: Record<string, unknown>[]; total: number; pii: boolean }>(a.db, "export_leads", { f: { ...filters, offset } });
      pii = res.pii;
      rows.push(...res.rows);
      if (res.rows.length < 500 || rows.length >= res.total) break;
    }
    const csv = "﻿" + [CSV_COLS.map((c) => c[0]).join(";"), ...rows.map((r) => CSV_COLS.map(([, f]) => csvCell(f(r))).join(";"))].join("\n");
    return { ok: true, data: { csv, rows: rows.length, pii } };
  } catch (e) {
    return fail(e);
  }
}

export async function lookupCep(cep: string): Promise<ActionResult<{ city: string; uf: string; slug: string; ibge: string | null; lat: number; lng: number; approx: boolean }>> {
  try {
    await actionAuth("builder.leads.create");
    const r = await resolveCep(cep);
    if (!r) return { ok: false, error: "Não achamos esse CEP. Confira os 8 dígitos." };
    return { ok: true, data: { city: r.city, uf: r.uf, slug: r.slug, ibge: r.ibge ?? null, lat: r.lat, lng: r.lng, approx: r.approx } };
  } catch (e) {
    return fail(e);
  }
}

export async function createLead(input: Record<string, string | boolean>): Promise<ActionResult<{ id: string; created: boolean; bora_number: number }>> {
  try {
    const a = await actionAuth("builder.leads.create");
    const geo = await resolveCep(String(input.cep ?? ""));
    if (!geo) return { ok: false, error: "Não achamos esse CEP. Confira os 8 dígitos." };
    const res = await rpc<{ id: string; created: boolean; bora_number: number }>(a.db, "create_lead", {
      p: {
        first_name: input.first_name, last_name: input.last_name, email: input.email, phone: input.phone, cep: geo.cep,
        cpf: input.cpf || null, birth_date: input.birth_date || null, sex: input.sex || null,
        state: geo.uf, city: geo.city, city_slug: geo.slug, ibge: geo.ibge, lat: geo.lat, lng: geo.lng, approx: geo.approx,
        referred_by: input.referred_by || null, privacy_consent: !!input.privacy_consent, marketing_consent: !!input.marketing_consent,
        utm_source: input.utm_source || null, utm_medium: input.utm_medium || null, utm_campaign: input.utm_campaign || null,
      },
    });
    revalidatePath("/builder/cadastros");
    return { ok: true, data: res };
  } catch (e) {
    return fail(e);
  }
}
