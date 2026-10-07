import { LinkButton } from "@/components/ui";
import { Shield } from "@/components/Logo";

export const metadata = { title: "Sem acesso" };

export default function SemAcesso() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center">
        <div className="flex justify-center"><Shield size={26} /></div>
        <p className="eyebrow mt-6">Sem permissão</p>
        <h1 className="mt-1 text-[18px] font-semibold">Essa área não está liberada para o seu papel.</h1>
        <p className="mt-2 text-fg-2">Se precisar dela, peça a um admin do BORA OS.</p>
        <LinkButton href="/builder" className="mt-6">Voltar</LinkButton>
      </div>
    </main>
  );
}
