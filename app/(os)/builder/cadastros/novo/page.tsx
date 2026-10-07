import { requirePerm } from "@/lib/auth";
import { PageHead } from "@/components/ui";
import { NewLeadForm } from "./NewLeadForm";

export const metadata = { title: "Novo cadastro" };

export default async function Novo() {
  await requirePerm("builder.leads.create");
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <PageHead eyebrow="Builder · Cadastros" title="Novo cadastro" desc="Mesmas regras da LP: cidade e UF pelo CEP, sem duplicar telefone, e-mail ou CPF. O cadastro ganha BORA ID e código de indicação." />
      <NewLeadForm />
    </div>
  );
}
