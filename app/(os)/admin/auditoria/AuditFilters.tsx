"use client";
import { useSetParam } from "@/components/builder/Filters";

const sel = "h-10 md:h-8 rounded-[10px] md:rounded-sm border border-line-strong bg-surface px-2 text-[12px]";

export function AuditFilters({ sp, members, actions, entities }: { sp: Record<string, string | undefined>; members: { id: string; name: string }[]; actions: Record<string, string>; entities: Record<string, string> }) {
  const set = useSetParam();
  return (
    <div className="flex flex-wrap gap-2">
      <select className={sel} value={sp.ator ?? ""} onChange={(e) => set({ ator: e.target.value || null, page: null })} aria-label="Quem">
        <option value="">Todos os autores</option>
        <option value="lp">LP (cadastro público)</option>
        <option value="mcp">Conexões MCP</option>
        <option value="system">Sistema</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <select className={sel} value={sp.acao ?? ""} onChange={(e) => set({ acao: e.target.value || null, page: null })} aria-label="Ação">
        <option value="">Todas as ações</option>
        {Object.entries(actions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <select className={sel} value={sp.entidade ?? ""} onChange={(e) => set({ entidade: e.target.value || null, page: null })} aria-label="Onde">
        <option value="">Todos os lugares</option>
        {Object.entries(entities).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
}
