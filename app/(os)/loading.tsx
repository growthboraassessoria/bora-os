// Aparece na hora do clique, enquanto a tela nova carrega: a troca parece instantânea.
export default function Loading() {
  const bar = "animate-pulse rounded-sm bg-surface-2";
  return (
    <div className="p-4 md:p-6" data-loading aria-busy="true" aria-label="Carregando">
      <div className={`${bar} h-3 w-32`} />
      <div className={`${bar} mt-2 h-6 w-56`} />
      <div className="mt-6 grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${bar} h-[86px]`} />)}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className={`${bar} h-72 xl:col-span-2`} />
        <div className={`${bar} h-72`} />
      </div>
    </div>
  );
}
