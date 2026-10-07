// O que o Builder deixa editar em cada página da LP. O padrão é o texto que está hoje no código da LP
// (lib/copy.ts e app/layout.tsx); campo vazio = a LP usa o padrão dela.

export type FieldDef = { key: string; label: string; kind: "text" | "textarea" | "lines" | "url" | "bool"; max?: number; def?: string; hint?: string };

export const SEO_FIELDS: FieldDef[] = [
  { key: "title", label: "Título da página", kind: "text", max: 70, hint: "Aparece na aba e no Google. Até ~60 caracteres." },
  { key: "description", label: "Descrição", kind: "textarea", max: 170, hint: "Resumo no Google. Até ~155 caracteres." },
  { key: "og_title", label: "Título ao compartilhar", kind: "text", max: 90, hint: "WhatsApp, Instagram, LinkedIn. Vazio = usa o título." },
  { key: "og_description", label: "Descrição ao compartilhar", kind: "textarea", max: 200 },
  { key: "og_image", label: "Imagem ao compartilhar (URL)", kind: "url", hint: "1200×630. Vazio = a imagem gerada pela LP." },
  { key: "canonical", label: "URL canônica", kind: "url", hint: "Só se a página tiver outro endereço oficial." },
  { key: "noindex", label: "Esconder do Google", kind: "bool" },
];

const SITE_DESC = "Quer treinar com a BORA, mas ainda não temos uma operação perto de você? Cadastre-se e coloque sua cidade no mapa.";

export const SEO_DEFAULTS: Record<string, Record<string, string>> = {
  "/": { title: "BORA na sua cidade · BORA, Vamos em Frente", description: SITE_DESC, og_title: "BORA na sua cidade." },
  "/obrigado": { title: "Você está dentro · BORA, Vamos em Frente" },
  "/ranking": { title: "Ranking das cidades · BORA, Vamos em Frente" },
  "/cidade/[slug]": { title: "{cidade} · BORA, Vamos em Frente", hint: "" },
  "/fundador": { title: "Aluno Fundador · BORA, Vamos em Frente" },
  "/privacidade": { title: "Privacidade · BORA, Vamos em Frente" },
  "/termos": { title: "Termos · BORA, Vamos em Frente" },
};

export const CONTENT_FIELDS: Record<string, FieldDef[]> = {
  "/": [
    { key: "hero.eyebrow", label: "Hero · linha de cima", kind: "text", max: 40, def: "BORA, VAMOS EM FRENTE" },
    { key: "hero.headline_a", label: "Hero · manchete A (uma linha por linha)", kind: "lines", max: 60, def: "BORA\nNA SUA\nCIDADE." },
    { key: "hero.headline_b", label: "Hero · manchete B (teste A/B)", kind: "lines", max: 60, def: "SUA CIDADE\nESTÁ PRONTA\nPARA A BORA?" },
    { key: "hero.sub", label: "Hero · subtítulo", kind: "textarea", max: 140, def: "Quer treinar com a BORA, mas ainda não temos uma operação perto de você?" },
    { key: "hero.text", label: "Hero · texto", kind: "textarea", max: 260, def: "Estamos mapeando as próximas cidades da BORA no Brasil. Cadastre-se, chame seus amigos e ajude sua cidade a entrar no mapa." },
    { key: "final.title", label: "Fechamento · manchete", kind: "lines", max: 60, def: "BORA COLOCAR\nSUA CIDADE\nNO MAPA?" },
  ],
};

export function contentFieldsFor(route: string) {
  return CONTENT_FIELDS[route] ?? [];
}
