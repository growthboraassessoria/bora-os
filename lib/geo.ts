// Cópia de lp-vamos-em-frente/lib/geo (sem o mapa): nomes, centros dos estados, slug e coordenadas. Manter igual à LP.
export const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul",
  MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco", PI: "Piauí", PR: "Paraná",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RO: "Rondônia", RR: "Roraima", RS: "Rio Grande do Sul",
  SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo", TO: "Tocantins",
};

/** Centro aproximado de cada estado (lat, lng). Usado só quando o CEP não traz coordenadas. */
export const UF_CENTER: Record<string, [number, number]> = {
  AC: [-9.0, -70.5], AL: [-9.6, -36.6], AM: [-4.2, -63.0], AP: [1.4, -51.8], BA: [-12.6, -41.7], CE: [-5.2, -39.5],
  DF: [-15.8, -47.9], ES: [-19.6, -40.5], GO: [-16.0, -49.6], MA: [-5.0, -45.3], MG: [-18.5, -44.4], MS: [-20.5, -54.6],
  MT: [-13.0, -55.9], PA: [-4.0, -52.6], PB: [-7.2, -36.6], PE: [-8.4, -37.9], PI: [-7.4, -42.8], PR: [-24.8, -51.6],
  RJ: [-22.3, -42.7], RN: [-5.8, -36.6], RO: [-10.9, -62.9], RR: [2.0, -61.4], RS: [-29.8, -53.3], SC: [-27.3, -50.3],
  SE: [-10.6, -37.4], SP: [-22.2, -48.7], TO: [-10.2, -48.3],
};

/** Coordenadas de apoio (lat, lng) para cidades frequentes, quando a API do CEP não devolve localização. */
export const CITY_COORDS: Record<string, [number, number]> = {
  "ac-rio-branco": [-9.97, -67.81], "al-maceio": [-9.67, -35.73], "am-manaus": [-3.1, -60.02], "ap-macapa": [0.03, -51.07],
  "ba-salvador": [-12.97, -38.5], "ba-feira-de-santana": [-12.27, -38.97], "ba-vitoria-da-conquista": [-14.86, -40.84],
  "ce-fortaleza": [-3.73, -38.52], "ce-juazeiro-do-norte": [-7.21, -39.32], "df-brasilia": [-15.78, -47.93],
  "es-vitoria": [-20.32, -40.34], "es-vila-velha": [-20.33, -40.29], "es-serra": [-20.13, -40.31],
  "go-goiania": [-16.68, -49.25], "go-anapolis": [-16.33, -48.95], "go-aparecida-de-goiania": [-16.82, -49.24], "go-rio-verde": [-17.79, -50.92],
  "ma-sao-luis": [-2.53, -44.3], "mg-belo-horizonte": [-19.92, -43.94], "mg-uberlandia": [-18.92, -48.28], "mg-juiz-de-fora": [-21.76, -43.35],
  "mg-contagem": [-19.93, -44.05], "mg-montes-claros": [-16.73, -43.86], "mg-lagoa-da-prata": [-20.02, -45.54], "mg-uberaba": [-19.75, -47.93],
  "ms-campo-grande": [-20.45, -54.65], "mt-cuiaba": [-15.6, -56.1], "pa-belem": [-1.46, -48.5], "pb-joao-pessoa": [-7.12, -34.86],
  "pb-campina-grande": [-7.23, -35.88], "pe-recife": [-8.05, -34.88], "pe-caruaru": [-8.28, -35.98], "pe-petrolina": [-9.39, -40.5],
  "pi-teresina": [-5.09, -42.8], "pr-curitiba": [-25.43, -49.27], "pr-londrina": [-23.31, -51.16], "pr-maringa": [-23.42, -51.93],
  "pr-cascavel": [-24.96, -53.46], "pr-foz-do-iguacu": [-25.55, -54.59], "rj-rio-de-janeiro": [-22.9, -43.2], "rj-niteroi": [-22.88, -43.1],
  "rj-petropolis": [-22.5, -43.18], "rj-volta-redonda": [-22.52, -44.1], "rn-natal": [-5.8, -35.2], "ro-porto-velho": [-8.76, -63.9],
  "rr-boa-vista": [2.82, -60.67], "rs-porto-alegre": [-30.03, -51.23], "rs-caxias-do-sul": [-29.17, -51.18], "rs-pelotas": [-31.77, -52.34],
  "sc-florianopolis": [-27.6, -48.55], "sc-joinville": [-26.3, -48.85], "sc-blumenau": [-26.92, -49.07], "sc-itajai": [-26.9, -48.66],
  "se-aracaju": [-10.95, -37.07], "sp-sao-paulo": [-23.55, -46.63], "sp-campinas": [-22.9, -47.06], "sp-sorocaba": [-23.5, -47.46],
  "sp-ribeirao-preto": [-21.17, -47.81], "sp-santos": [-23.96, -46.33], "sp-sao-jose-dos-campos": [-23.18, -45.88], "sp-indaiatuba": [-23.09, -47.21],
  "sp-guarulhos": [-23.46, -46.53], "sp-osasco": [-23.53, -46.79], "sp-sao-bernardo-do-campo": [-23.69, -46.56], "sp-bauru": [-22.31, -49.06],
  "sp-piracicaba": [-22.72, -47.65], "sp-jundiai": [-23.19, -46.88], "to-palmas": [-10.18, -48.33],
};

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function citySlug(name: string, uf: string): string {
  return `${uf.toLowerCase()}-${slugify(name)}`;
}

/** Resolve coordenadas de uma cidade: as da API, a tabela de apoio ou o centro do estado (aproximado). */
export function cityCoords(slug: string, uf: string, fromApi?: { lat?: number | null; lng?: number | null }) {
  if (fromApi && typeof fromApi.lat === "number" && typeof fromApi.lng === "number" && Number.isFinite(fromApi.lat) && Number.isFinite(fromApi.lng)) {
    return { lat: fromApi.lat, lng: fromApi.lng, approx: false };
  }
  const known = CITY_COORDS[slug];
  if (known) return { lat: known[0], lng: known[1], approx: false };
  const c = UF_CENTER[uf] ?? [-15, -50];
  return { lat: c[0], lng: c[1], approx: true };
}
