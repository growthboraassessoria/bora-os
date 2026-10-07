# BORA OS

Sistema interno da BORA. Primeiro módulo: **BORA Builder**, que se conecta às LPs. Áreas de **Admin** e **MCP**. Destino: `https://os.boraassessoria.com`.

Arquitetura: [`caixa-bora/ideias/2026-10-07-bora-os-arquitetura.md`](../caixa-bora/ideias/2026-10-07-bora-os-arquitetura.md).

## Stack

Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript, Tailwind v4, Radix, Recharts, Supabase (Auth com TOTP, Postgres com RLS), servidor MCP com `mcp-handler` 2 e `postgres` no gateway.

## Rodar

```bash
npm install
cp .env.example .env.local   # preencher com o projeto de homologação
npx next dev -p 3100
```

`.env.local` aponta para o banco da LP (`zivjyyapvbbaxkegzqys`, org "Bora Assessoria"), onde estão os cadastros reais. Homologação em `.env.staging.local`.

## Banco

O BORA OS é o dono das migrations do banco (inclusive as da LP, `0001` a `0003`, copiadas com o mesmo número).

| Migration | O que faz |
| --- | --- |
| `0003_area_do_membro` | Da LP (07/10): perfil, foto, Instagram, segundo telefone, perfil público. |
| `0004_os_fundacao` | Membros, papéis, permissões, escopo, auditoria imutável, sessões. Toda permissão exige `aal2`, sessão viva e membro ativo. |
| `0005_builder` | Sites, páginas, versões, configurações, notas, etiquetas; colunas novas nas tabelas da LP; funções de cadastro, painel, indicações, origem, cidades, qualificação e eventos. |
| `0006_mcp` | Conexões, ferramentas, chamadas e o gateway (`mcp.describe`, `mcp.call`) com o papel `mcp_gateway`. |
| `0007`–`0013` | Ajustes: permissões da chave de serviço, busca volátil, `search_path` da função da LP, autoria com `on delete set null`, slug da LP, lista sempre mascarada, funções de admin e os campos da área do membro no OS. |

```bash
supabase link --project-ref <ref>
supabase db push          # aplica as migrations
supabase config push      # Auth: sem cadastro público, senha forte, TOTP ligado, JWT de 15 min
```

A senha do papel `mcp_gateway` fica fora do git: `alter role mcp_gateway with login password '…';` e vai em `MCP_DATABASE_URL` (pooler, modo transação, usuário `mcp_gateway.<ref>`).

Dados fictícios na homologação: `supabase db query --linked -f supabase/seed-demo.sql` (recusa rodar se achar dado real).

## Membros

```bash
node --env-file=.env.local scripts/create-member.mjs email@dominio "Nome Completo" owner
```

Papéis: `owner`, `admin`, `growth`, `comercial`, `leitura` (e os personalizados, criados na tela). A senha provisória aparece uma vez; no primeiro acesso a pessoa ativa o Google Authenticator e cria a senha definitiva. Depois disso, membros novos são criados pela tela **Admin › Membros**.

## Testes

| Script | O que prova |
| --- | --- |
| `scripts/e2e-db.mjs` | 37 checagens de segurança no banco: segundo fator, acesso direto, papéis, escopo de UF, dado pessoal, auditoria imutável, sessão encerrada, MCP. |
| `scripts/qa-first-access.mjs` | Primeiro acesso pelo navegador: senha provisória → autenticador → senha definitiva → painel; papel sem Admin. |
| `scripts/qa-flow.mjs` | Fluxos que gravam: revelar, nota, edição, histórico, publicar SEO, chave MCP, criar membro, exportar, auditoria. |
| `scripts/qa-ui.mjs` | Capturas das telas nos dois temas e checagem de estouro horizontal. |

```bash
node --env-file=.env.local scripts/e2e-db.mjs
```

## MCP

`POST /api/mcp` com `Authorization: Bearer bos_…`. A chave nasce na tela **MCP › Conexões** (mostrada uma vez, guardada como hash). O gateway não usa chave de serviço: entra no Postgres como `mcp_gateway`, que só executa `mcp.describe` e `mcp.call`. Cada chamada confere chave, validade, IP, permissões (as da chave ∩ as do criador hoje), escopo e limite de 60/min, e fica em `mcp.calls`.

```bash
claude mcp add --transport http bora-os https://os.boraassessoria.com/api/mcp --header "Authorization: Bearer bos_…"
```

## Integração com as LPs

Em `integracao-lp/`: o lado LP do contrato do Builder (ler conteúdo publicado, cache por etiqueta, revalidação assinada). Ver o README de lá.

## Deploy (pendente)

1. Repositório `growthboraassessoria/bora-os` e projeto na Vercel (time `bora-assessoria`).
2. Variáveis de produção: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MCP_DATABASE_URL`, `BUILDER_REVALIDATE_SECRET`, `NEXT_PUBLIC_SITE_URL=https://os.boraassessoria.com`.
3. Banco: o da LP, `zivjyyapvbbaxkegzqys` (org "Bora Assessoria"), já tem as migrations 0001–0013 e a configuração (schemas expostos, TOTP, sem cadastro público). Pooler: `aws-0-us-east-1`.
4. CNAME `os` → Vercel no DNS de `boraassessoria.com`.
