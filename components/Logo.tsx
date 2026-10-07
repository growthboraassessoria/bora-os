// Marca do BORA OS: escudo com raio (desenho simplificado do símbolo) + "BORA OS".
export function Shield({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 40 50" aria-hidden>
      <path d="M20 1 38 7v17c0 12-8 20-18 25C10 44 2 36 2 24V7L20 1Z" fill="var(--fg)" />
      <path d="M23 9 11 28h8l-3 13 13-20h-8l2-12Z" fill="var(--signal)" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <Shield size={18} />
      <span className="text-[14px] font-bold tracking-[0.02em] text-fg">
        BORA <span className="mono font-medium text-fg-3">OS</span>
      </span>
    </span>
  );
}
