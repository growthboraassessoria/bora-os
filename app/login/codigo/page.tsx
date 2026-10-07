import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { AuthFrame } from "../AuthFrame";
import { CodeForm } from "../forms";
import { signOut } from "../actions";

export const metadata = { title: "Código" };

export default async function Codigo({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const a = await getAuth();
  if (a.stage === "anon" || a.stage === "no-member") redirect("/login");
  if (a.stage === "enroll") redirect("/login/autenticador");
  const { next } = await searchParams;
  const reconfirm = a.stage === "ok";
  return (
    <AuthFrame step={reconfirm ? "confirmação" : "2 de 2 · autenticador"} title={reconfirm ? "Confirme que é você" : "Código do autenticador"} desc="Abra o Google Authenticator e digite o código do BORA OS.">
      <CodeForm next={next} />
      <form action={signOut} className="mt-4 text-center">
        <button className="text-fg-3 underline-offset-4 hover:text-fg hover:underline">Sair e entrar com outra conta</button>
      </form>
    </AuthFrame>
  );
}
