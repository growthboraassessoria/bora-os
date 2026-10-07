// Cópia de lp-vamos-em-frente/lib/cep.ts: mesma consulta (BrasilAPI v2 com ViaCEP de reserva) e o mesmo slug da LP.
import "server-only";
import { citySlug, cityCoords } from "./geo";



export type CepResult = {
  cep: string;
  city: string;
  uf: string;
  ibge: string | null;
  neighborhood: string | null;
  slug: string;
  lat: number;
  lng: number;
  approx: boolean;
  source: "brasilapi" | "viacep" | "brasilapi+viacep";
};

const TIMEOUT = 4500;

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), next: { revalidate: 86400 } });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function normalizeCep(raw: string): string | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  return d.length === 8 ? d : null;
}

export async function resolveCep(raw: string): Promise<CepResult | null> {
  const cep = normalizeCep(raw);
  if (!cep) return null;
  const [brasil, via] = await Promise.all([
    getJson(`https://brasilapi.com.br/api/cep/v2/${cep}`),
    getJson(`https://viacep.com.br/ws/${cep}/json/`),
  ]);
  const viaOk = via && !via.erro && typeof via.localidade === "string" ? via : null;
  const brasilOk = brasil && typeof brasil.city === "string" && typeof brasil.state === "string" ? brasil : null;
  if (!brasilOk && !viaOk) return null;

  const city = String((brasilOk?.city ?? viaOk?.localidade) as string).trim();
  const uf = String((brasilOk?.state ?? viaOk?.uf) as string).trim().toUpperCase();
  const brasilIbge = (brasilOk?.ibge as { city?: string } | undefined)?.city;
  const ibge = viaOk && typeof viaOk.ibge === "string" && viaOk.ibge ? viaOk.ibge : typeof brasilIbge === "string" && brasilIbge ? brasilIbge : null;
  const neighborhood = (brasilOk?.neighborhood as string | undefined) ?? (viaOk?.bairro as string | undefined) ?? null;
  const slug = citySlug(city, uf);

  let apiLat: number | null = null;
  let apiLng: number | null = null;
  const loc = brasilOk?.location as { coordinates?: { latitude?: string | number; longitude?: string | number } } | undefined;
  if (loc?.coordinates) {
    const la = Number(loc.coordinates.latitude);
    const ln = Number(loc.coordinates.longitude);
    if (Number.isFinite(la) && Number.isFinite(ln) && la !== 0 && ln !== 0) {
      apiLat = la;
      apiLng = ln;
    }
  }
  const coords = cityCoords(slug, uf, { lat: apiLat, lng: apiLng });
  const source = brasilOk && viaOk ? "brasilapi+viacep" : brasilOk ? "brasilapi" : "viacep";
  return { cep, city, uf, ibge, neighborhood: neighborhood || null, slug, lat: coords.lat, lng: coords.lng, approx: coords.approx, source };
}
