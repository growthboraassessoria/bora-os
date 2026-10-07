import { Logo } from "@/components/Logo";

export function AuthFrame({ step, title, desc, children }: { step: string; title: string; desc?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <span className="eyebrow">{step}</span>
        </div>
        <div className="rounded-md border border-line bg-surface p-6">
          <h1 className="text-[17px] font-semibold tracking-tight">{title}</h1>
          {desc && <div className="mt-1.5 text-fg-2">{desc}</div>}
          <div className="mt-5">{children}</div>
        </div>
        <p className="eyebrow mt-6 text-center">Acesso restrito · cada ação fica registrada</p>
      </div>
    </main>
  );
}
