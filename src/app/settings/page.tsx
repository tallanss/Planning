import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const company = await prisma.company.findFirst({ include: { rules: true, sites: true, departments: { include: { site: true } } } });
  if (!company) return <div className="p-8">Aucune entreprise.</div>;
  const rules = company.rules[0];

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-6">
      <h1 className="mb-1 text-2xl font-semibold">Réglages</h1>
      <p className="mb-6 text-sm text-neutral-500">Entreprise, sites, règles légales</p>

      <section className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Entreprise</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Nom">{company.name}</Info>
          <Info label="Pays">{company.country}</Info>
          <Info label="Fuseau horaire">{company.timezone}</Info>
          <Info label="Début de semaine">{company.weekStart === 1 ? "Lundi" : "Dimanche"}</Info>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Sites &amp; départements</h2>
        <div className="space-y-3">
          {company.sites.map((s) => (
            <div key={s.id} className="rounded-md border border-neutral-100 p-3">
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-neutral-500">{s.address ?? ""}</div>
              <div className="mt-2 flex flex-wrap gap-1">
                {company.departments.filter((d) => d.siteId === s.id).map((d) => (
                  <span key={d.id} className="rounded px-2 py-0.5 text-xs" style={{ background: d.color + "22", color: d.color }}>
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 font-semibold">Règles légales</h2>
        <p className="mb-3 text-xs text-neutral-500">Utilisées par le générateur pour garantir la conformité du planning</p>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <Info label="Repos quotidien min">{rules.minDailyRestH}h</Info>
          <Info label="Repos hebdo min">{rules.minWeeklyRestH}h</Info>
          <Info label="Max h/jour">{rules.maxDailyH}h</Info>
          <Info label="Max h/semaine">{rules.maxWeeklyH}h</Info>
          <Info label="Moyenne max 12 sem">{rules.maxAvgWeeklyH}h</Info>
          <Info label="Amplitude max">{rules.maxAmplitudeH}h</Info>
          <Info label="Pause après">{rules.breakAfterH}h → {rules.breakMin}min</Info>
          <Info label="Jours consécutifs max">{rules.maxConsecDays}</Info>
        </div>
      </section>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="font-medium">{children}</div>
    </div>
  );
}
