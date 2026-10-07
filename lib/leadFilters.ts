// Filtros da lista de cadastros: da URL para o formato das funções do banco.
export function filtersFrom(sp: Record<string, string | undefined>) {
  return {
    q: sp.q || null, uf: sp.uf || null, source: sp.origem || null,
    referred: sp.indicado ? sp.indicado === "true" : null, answered: sp.respondeu ? sp.respondeu === "true" : null,
    founder: sp.fundador ? sp.fundador === "true" : null, marketing: sp.marketing ? sp.marketing === "true" : null,
    tag: sp.tag || null, sort: sp.sort || "created_at", dir: sp.dir || "desc",
  };
}
