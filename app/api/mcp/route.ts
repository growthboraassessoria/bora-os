// Servidor MCP do BORA OS: https://os.boraassessoria.com/api/mcp
// Autenticação por chave (Authorization: Bearer bos_...). Cada requisição monta um servidor só com as ferramentas
// que a chave pode usar; cada chamada passa pelo gateway no banco, que confere tudo de novo e registra.
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { describe, call, hashToken } from "@/lib/mcp/gateway";
import { resolveCep } from "@/lib/cep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const iso = z.string().describe("Data ISO, ex.: 2026-10-01").optional();
const uf = z.string().length(2).describe("UF, ex.: GO").optional();

type ToolDef = { schema: z.ZodObject<z.ZodRawShape>; map?: (a: Record<string, unknown>) => Promise<Record<string, unknown> | { error: string }> | Record<string, unknown> };

const TOOLS: Record<string, ToolDef> = {
  resumo_campanha: { schema: z.object({ de: iso, ate: iso, uf }) },
  buscar_cadastros: {
    schema: z.object({
      busca: z.string().max(120).describe("Nome, BORA ID (#0001), código ou cidade. E-mail, telefone e CPF só com permissão de dados pessoais.").optional(),
      uf, cidade: z.string().describe("Slug da cidade, ex.: go-goiania").optional(), origem: z.string().describe("utm_source, ou (direto)").optional(),
      indicado: z.boolean().optional(), de: iso, ate: iso, limite: z.number().int().min(1).max(100).optional(), pular: z.number().int().min(0).optional(),
    }),
  },
  ver_cadastro: { schema: z.object({ bora_id: z.union([z.string(), z.number()]).describe("Ex.: 417 ou #0417").optional(), codigo: z.string().optional(), revelar: z.boolean().describe("Contato completo; exige permissão e fica registrado.").optional() }), map: (a) => ({ ...a, bora_id: a.bora_id == null ? undefined : String(a.bora_id) }) },
  ranking_cidades: { schema: z.object({ uf }) },
  rede_indicacao: { schema: z.object({ codigo: z.string().min(3) }) },
  origem_cadastros: { schema: z.object({ de: iso, ate: iso, toque: z.enum(["primeiro", "ultimo"]).optional() }), map: (a) => ({ ...a, toque: a.toque === "primeiro" ? "first" : "last" }) },
  respostas_qualificacao: { schema: z.object({ uf }) },
  eventos_recentes: { schema: z.object({ evento: z.string().optional(), limite: z.number().int().min(1).max(200).optional() }) },
  criar_cadastro: {
    schema: z.object({
      first_name: z.string().min(1), last_name: z.string().min(1), email: z.string().email(), phone: z.string().min(10), cep: z.string().min(8),
      cpf: z.string().optional(), referred_by: z.string().optional(), privacy_consent: z.literal(true).describe("A pessoa aceitou o aviso de privacidade."), marketing_consent: z.boolean().optional(),
      utm_source: z.string().optional(),
    }),
    map: async (a) => {
      const g = await resolveCep(String(a.cep));
      if (!g) return { error: "cep_nao_encontrado" };
      return { ...a, cep: g.cep, state: g.uf, city: g.city, city_slug: g.slug, ibge: g.ibge, lat: g.lat, lng: g.lng, approx: g.approx };
    },
  },
  atualizar_cadastro: {
    schema: z.object({ bora_id: z.union([z.string(), z.number()]).optional(), codigo: z.string().optional(), campos: z.record(z.string(), z.union([z.string(), z.boolean()])).describe("first_name, last_name, email, phone, cpf, birth_date, sex, cep, marketing_consent") }),
    map: (a) => ({ ...a, bora_id: a.bora_id == null ? undefined : String(a.bora_id) }),
  },
};

function unauthorized(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 401, headers: { "content-type": "application/json", "www-authenticate": 'Bearer realm="BORA OS"' } });
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!/^bos_[A-Za-z0-9_-]{20,}$/.test(token)) return unauthorized("chave ausente ou inválida");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  const hash = hashToken(token);
  const d = await describe(hash, ip);
  if (!d) return unauthorized("chave inválida, vencida ou revogada");

  const handler = createMcpHandler(
    (server) => {
      for (const t of d.tools) {
        const def = TOOLS[t.name];
        if (!def) continue;
        server.registerTool(
          t.name,
          { title: t.name.replace(/_/g, " "), description: t.description, inputSchema: def.schema, annotations: { readOnlyHint: !t.write, destructiveHint: false } },
          async (args: Record<string, unknown>) => {
            const mapped = def.map ? await def.map(args) : args;
            if ("error" in mapped && Object.keys(mapped).length === 1) return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(mapped) }] };
            const res = await call(hash, t.name, mapped, ip);
            return { isError: !!res.error, content: [{ type: "text" as const, text: JSON.stringify(res, null, 1) }] };
          },
        );
      }
    },
    { serverInfo: { name: "bora-os", version: "0.1.0" }, instructions: `BORA OS · conexão "${d.name}". Dados da campanha BORA, Vamos em Frente. Contato de pessoas vem mascarado, salvo permissão explícita. Toda chamada é registrada.` },
  );
  return handler(req);
}

export { handle as GET, handle as POST, handle as DELETE };
