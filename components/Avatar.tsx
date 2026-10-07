// Foto do perfil enviada na área do membro da LP (bucket público "avatars"); sem foto, as iniciais.
import { cx } from "./ui";

export function Avatar({ url, name, size = 28, className }: { url?: string | null; name: string; size?: number; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={`Foto de ${name}`} width={size} height={size} loading="lazy" className={cx("shrink-0 rounded-full border border-line object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className={cx("mono grid shrink-0 place-items-center rounded-full border border-line bg-surface-3 text-fg-3", className)} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}>{initials}</span>
  );
}
