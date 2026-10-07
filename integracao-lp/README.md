# Integração da LP com o BORA Builder

O lado LP do contrato do Builder (seção 9 da arquitetura). Os arquivos ficam aqui, fora da LP, porque a LP tem mudanças locais em andamento. Aplicar quando essas mudanças forem commitadas.

## O que copiar

| Arquivo daqui | Vai para `projetos/lp-vamos-em-frente/` |
| --- | --- |
| `lib/builder-content.ts` | `lib/builder-content.ts` |
| `app/api/revalidate/route.ts` | `app/api/revalidate/route.ts` |

E no `proxy.ts` da LP, `api` já está fora do matcher: nada a mudar.

## Os quatro pontos do contrato

1. **Ler o conteúdo publicado.** Trocar o `export const metadata` de `app/layout.tsx` por:

   ```ts
   import { getSeo } from "@/lib/builder-content";

   export async function generateMetadata(): Promise<Metadata> {
     const seo = await getSeo("/", { title: "BORA na sua cidade · BORA, Vamos em Frente", description: SITE.description, og_title: "BORA na sua cidade." });
     return {
       metadataBase: new URL(siteUrl),
       title: { default: seo.title!, template: "%s · BORA, Vamos em Frente" },
       description: seo.description,
       alternates: seo.canonical ? { canonical: seo.canonical } : undefined,
       openGraph: { title: seo.og_title, description: seo.og_description, type: "website", locale: "pt_BR", siteName: SITE.name, ...(seo.og_image ? { images: [seo.og_image] } : {}) },
       twitter: { card: "summary_large_image", title: seo.og_title, description: seo.og_description },
       robots: seo.noindex ? { index: false, follow: false } : { index: true, follow: true },
       appleWebApp: { capable: true, statusBarStyle: "default", title: "BORA" },
       formatDetection: { telephone: false },
     };
   }
   ```

   Nos textos do hero, trocar `HERO.sub` por `await getText("/", "hero.sub", HERO.sub)` (e igual para `hero.eyebrow`, `hero.text`, `hero.headline_a`, `hero.headline_b`, `final.title`). O Hero recebe os textos por prop do Server Component da página.

   Configurações: `CITY_GOAL` e `FOUNDER_SLOTS` (hoje fixos em `lib/db/types.ts`) passam a vir de `await getSetting("city_goal", 500)` e `await getSetting("founder_slots", 50)`; o checkout, de `await getSetting("checkout_url", process.env.NEXT_PUBLIC_CHECKOUT_URL)`.

2. **Cache por etiqueta.** Já está em `getPublished`: cache de 5 minutos com a etiqueta `builder:vamos-em-frente`.

3. **Revalidação assinada.** A rota `/api/revalidate` confere a assinatura e o horário e limpa a etiqueta. Cadastrar na Vercel da LP a variável `BUILDER_REVALIDATE_SECRET` com o mesmo valor do OS.

4. **Gravar com `site_id`.** Nada a fazer: a coluna tem padrão `vamos-em-frente`. Uma LP nova grava o próprio `site_id`.

## Dois ajustes de medição

- **Variante no `page_view`:** em `components/AnalyticsBoot.tsx`, enviar `track("page_view", { variant })` com a variante do cookie `bora_exp`. Sem isso, o painel não separa visitantes por variante do teste A/B.
- **Eventos que faltam:** clique no grupo de WhatsApp (`whatsapp_clicked`), início do checkout (`checkout_started`) e compra do Fundador (`founder_purchase`).

## Pré-requisito no banco de produção

As migrations `0004` a `0013` do BORA OS precisam estar aplicadas no projeto Supabase de produção, e os schemas `os`, `builder` e `mcp` expostos na API. Sem isso, `getPublished` devolve vazio e a LP segue com os textos padrão.
