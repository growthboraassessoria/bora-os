import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { AuthFrame } from "../AuthFrame";
import { EnrollForm } from "../forms";

export const metadata = { title: "Configurar autenticador" };

export default async function Autenticador() {
  const a = await getAuth();
  if (a.stage === "anon" || a.stage === "no-member") redirect("/login");
  if (a.stage !== "enroll") redirect("/login/codigo");
  return (
    <AuthFrame step="2 de 2 · autenticador" title="Ative o segundo fator" desc="No BORA OS, todo acesso pede senha e o código do Google Authenticator. Sem isso, nada abre.">
      <EnrollForm />
    </AuthFrame>
  );
}
