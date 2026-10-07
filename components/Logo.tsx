// Marca oficial da BORA (arquivos do kit de identidade 2026, os mesmos da LP).
// Duas versões em cada lugar: branca no tema escuro, preta no claro. O CSS mostra só a do tema ativo.
/* eslint-disable @next/next/no-img-element */

/** Símbolo: o escudo com o raio. */
export function Shield({ size = 22 }: { size?: number }) {
  const h = Math.round(size * 1.275);
  return (
    <span className="inline-flex" style={{ width: size, height: h }}>
      <img src="/brand/simbolo-white.png" alt="" width={size} height={h} className="theme-dark-only h-full w-full object-contain" />
      <img src="/brand/simbolo-black.png" alt="" width={size} height={h} className="theme-light-only h-full w-full object-contain" />
    </span>
  );
}

/** Logotipo BORA + "OS". */
export function Logo({ height = 16 }: { height?: number }) {
  const w = Math.round(height * 3.9);
  return (
    <span className="flex items-center gap-2" aria-label="BORA OS">
      <span className="inline-flex" style={{ width: w, height }}>
        <img src="/brand/logo-white.png" alt="BORA" width={w} height={height} className="theme-dark-only h-full w-full object-contain" />
        <img src="/brand/logo-black.png" alt="BORA" width={w} height={height} className="theme-light-only h-full w-full object-contain" />
      </span>
      <span className="mono text-[12px] font-medium tracking-[0.08em] text-fg-3" style={{ lineHeight: `${height}px` }}>OS</span>
    </span>
  );
}
