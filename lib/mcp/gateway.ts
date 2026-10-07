// Gateway MCP → Postgres com o papel mcp_gateway, que só executa mcp.describe e mcp.call.
// Nenhuma chave de serviço aqui: o banco confere chave, validade, IP, permissões, escopo e limite, e registra cada chamada.
import "server-only";
import postgres from "postgres";
import { createHash } from "node:crypto";

let sql: ReturnType<typeof postgres> | null = null;
function db() {
  const url = process.env.MCP_DATABASE_URL;
  if (!url) throw new Error("MCP_DATABASE_URL ausente");
  sql ??= postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 });
  return sql;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type Described = { name: string; connection: string; tools: { name: string; description: string; write: boolean }[] };

export async function describe(hash: string, ip: string | null): Promise<Described | null> {
  const [row] = await db()`select mcp.describe(${hash}, ${ip}) as d`;
  return (row?.d as Described | null) ?? null;
}

export async function call(hash: string, tool: string, args: Record<string, unknown>, ip: string | null): Promise<Record<string, unknown>> {
  const [row] = await db()`select mcp.call(${hash}, ${tool}, ${db().json(args as never)}, ${ip}) as r`;
  return (row?.r as Record<string, unknown>) ?? { error: "sem_resposta" };
}
