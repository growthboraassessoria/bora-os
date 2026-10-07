import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { AuthFrame } from "../AuthFrame";
import { NewPasswordForm } from "../forms";

export const metadata = { title: "Nova senha" };

export default async function NovaSenha() {
  const a = await getAuth();
  if (a.stage !== "password") redirect("/login");
  return (
    <AuthFrame step="primeiro acesso" title={`Olá, ${a.member.full_name.split(" ")[0]}`} desc="A senha que você recebeu é provisória. Crie a sua para continuar.">
      <NewPasswordForm />
    </AuthFrame>
  );
}
