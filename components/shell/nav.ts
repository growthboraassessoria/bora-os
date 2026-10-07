import type { Perm } from "@/lib/perms";

export type NavItem = { href: string; label: string; perm?: Perm; exact?: boolean };
export type NavModule = { id: string; label: string; href: string; icon: "builder" | "mcp" | "admin" | "conta"; items: NavItem[] };

export const MODULES: NavModule[] = [
  {
    id: "builder",
    label: "Builder",
    href: "/builder",
    icon: "builder",
    items: [
      { href: "/builder", label: "Painel", perm: "builder.dashboard.read", exact: true },
      { href: "/builder/cadastros", label: "Cadastros", perm: "builder.leads.read" },
      { href: "/builder/indicacoes", label: "Indicações", perm: "builder.referrals.read" },
      { href: "/builder/origem", label: "Origem", perm: "builder.analytics.read" },
      { href: "/builder/cidades", label: "Cidades", perm: "builder.dashboard.read" },
      { href: "/builder/qualificacao", label: "Qualificação", perm: "builder.analytics.read" },
      { href: "/builder/eventos", label: "Ao vivo", perm: "builder.analytics.read" },
      { href: "/builder/conteudo", label: "Conteúdo e SEO", perm: "builder.sites.read" },
      { href: "/builder/configuracoes", label: "Configurações", perm: "builder.sites.read" },
    ],
  },
  {
    id: "mcp",
    label: "MCP",
    href: "/mcp",
    icon: "mcp",
    items: [
      { href: "/mcp", label: "Conexões", exact: true },
      { href: "/mcp/ferramentas", label: "Ferramentas" },
      { href: "/mcp/chamadas", label: "Chamadas", perm: "mcp.calls.read" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    href: "/admin/membros",
    icon: "admin",
    items: [
      { href: "/admin/membros", label: "Membros", perm: "admin.members.manage" },
      { href: "/admin/papeis", label: "Papéis e permissões", perm: "admin.roles.manage" },
      { href: "/admin/auditoria", label: "Auditoria", perm: "admin.audit.read" },
    ],
  },
  {
    id: "conta",
    label: "Minha conta",
    href: "/conta",
    icon: "conta",
    items: [{ href: "/conta", label: "Segurança", exact: true }],
  },
];
