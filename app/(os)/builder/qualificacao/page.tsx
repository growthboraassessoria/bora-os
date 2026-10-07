import { requirePerm } from "@/lib/auth";
import { rpc } from "@/lib/builder";
import { QUESTION_LABEL } from "@/lib/eventLabels";
import { num, pct, ratio } from "@/lib/format";
import { PageHead, Panel, Stat, Bar, Empty } from "@/components/ui";
import { UfPicker } from "@/components/builder/Filters";

export const metadata = { title: "Qualificação" };
type Q = { answered: number; leads: number; questions: Record<string, { answer: string; n: number }[]> };

export default async function Qualificacao({ searchParams }: { searchParams: Promise<{ uf?: string }> }) {
  const a = await requirePerm("builder.analytics.read");
  const sp = await searchParams;
  const d = await rpc<Q>(a.db, "qualification", { f: { uf: sp.uf || null } });
  const order = ["runs", "with", "distance", "goal", "open", "intent", "price"];
  const free = ["club", "company"];

  return (
    <div className="p-4 md:p-6">
      <PageHead eyebrow="Builder · Qualificação" title="O que as pessoas responderam" desc="As nove perguntas opcionais da página de obrigado. Clubes e empresas citados viram sinais para Powered Clubs e Enterprise." right={<UfPicker value={sp.uf} allowed={a.ufs} />} />
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Responderam" value={num(d.answered)} />
        <Stat label="Taxa de resposta" value={pct(ratio(d.answered, d.leads))} />
        <Stat label="Clubes citados" value={num(d.questions.club?.length ?? 0)} />
        <Stat label="Empresas citadas" value={num(d.questions.company?.length ?? 0)} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {order.map((k) => {
          const rows = d.questions[k] ?? [];
          const total = rows.reduce((s, r) => s + r.n, 0);
          return (
            <Panel key={k} eyebrow={`${num(total)} respostas`} title={QUESTION_LABEL[k]}>
              <ul className="space-y-2">
                {rows.map((r) => (
                  <li key={r.answer}>
                    <div className="mb-1 flex justify-between gap-2"><span className="truncate">{r.answer}</span><span className="num text-fg-2">{pct(ratio(r.n, total), 0)}</span></div>
                    <Bar value={r.n} max={rows[0]?.n ?? 0} />
                  </li>
                ))}
              </ul>
              {!rows.length && <Empty title="Sem respostas." />}
            </Panel>
          );
        })}
        {free.map((k) => (
          <Panel key={k} eyebrow={k === "club" ? "Sinal · Powered Clubs" : "Sinal · Enterprise"} title={QUESTION_LABEL[k]} pad={false}>
            <ul>
              {(d.questions[k] ?? []).slice(0, 12).map((r) => (
                <li key={r.answer} className="flex justify-between border-b border-line px-4 py-1.5 last:border-0"><span>{r.answer}</span><span className="num text-fg-2">{num(r.n)}</span></li>
              ))}
            </ul>
            {!(d.questions[k] ?? []).length && <Empty title="Ninguém citou ainda." />}
          </Panel>
        ))}
      </div>
    </div>
  );
}
