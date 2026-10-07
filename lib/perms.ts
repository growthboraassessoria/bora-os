// Catálogo de permissões. A fonte da verdade é a tabela os.permissions; aqui só os nomes, para o TypeScript.
export const PERMS = [
  "builder.dashboard.read",
  "builder.leads.read",
  "builder.leads.pii",
  "builder.leads.create",
  "builder.leads.edit",
  "builder.leads.anonymize",
  "builder.leads.export",
  "builder.referrals.read",
  "builder.analytics.read",
  "builder.sites.read",
  "builder.sites.edit",
  "builder.sites.publish",
  "admin.members.manage",
  "admin.roles.manage",
  "admin.audit.read",
  "admin.security.manage",
  "mcp.connections.manage",
  "mcp.calls.read",
] as const;

export type Perm = (typeof PERMS)[number];

export const MODULE_LABEL: Record<string, string> = { builder: "Builder", admin: "Admin", mcp: "MCP" };
