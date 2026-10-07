"use client";
// Gráficos: cinzas e uma série no sinal. Sem pizza, no máximo duas cores.
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { stroke: "var(--fg-3)", fontSize: 10.5, fontFamily: "var(--font-mono)", tickLine: false, axisLine: false } as const;

function Tip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-line-strong bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow)]">
      <p className="eyebrow mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="num flex items-center gap-2"><span className="h-2 w-2" style={{ background: p.color }} />{p.name}: {new Intl.NumberFormat("pt-BR").format(p.value)}</p>
      ))}
    </div>
  );
}

export function DailyChart({ data }: { data: { day: string; leads: number; referred: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: d.day.slice(8, 10) + "/" + d.day.slice(5, 7), direct: d.leads - d.referred }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="label" {...axis} minTickGap={24} />
          <YAxis {...axis} allowDecimals={false} />
          <Tooltip content={<Tip />} cursor={{ stroke: "var(--line-strong)" }} />
          <Area type="monotone" dataKey="direct" name="Diretos" stackId="1" stroke="var(--chart-2)" fill="var(--chart-3)" fillOpacity={0.6} strokeWidth={1.25} isAnimationActive={false} />
          <Area type="monotone" dataKey="referred" name="Por indicação" stackId="1" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.35} strokeWidth={1.5} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HBars({ data, height = 220 }: { data: { label: string; value: number; highlight?: boolean }[]; height?: number }) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={120} {...axis} />
          <Tooltip content={<Tip />} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="value" name="Total" fill="var(--chart-2)" radius={1} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
