import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { AuthFrame } from "./AuthFrame";
import { PasswordForm } from "./forms";

export const metadata = { title: "Entrar" };

export default async function Login() {
  const a = await getAuth();
  if (a.stage === "verify") redirect("/login/codigo");
  if (a.stage === "enroll") redirect("/login/autenticador");
  if (a.stage === "ok") redirect("/builder");
  return (
    <AuthFrame step="1 de 2 · senha" title="Entrar no BORA OS" desc="Use o e-mail e a senha que o admin te passou.">
      <PasswordForm />
    </AuthFrame>
  );
}
