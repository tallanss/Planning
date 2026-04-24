import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PositionsPage() {
  const company = await prisma.company.findFirst();
  if (!company) return <div className="p-8">Aucune entreprise.</div>;
  const positions = await prisma.position.findMany({
    where: { companyId: company.id },
    include: { requiredSkills: { include: { skill: true } } },
    orderBy: { name: "asc" },
  });
  const skills = await prisma.skill.findMany({ where: { companyId: company.id } });

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <h1 className="mb-4 text-2xl font-semibold">Postes</h1>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {positions.map((p) => (
          <div key={p.id} className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
              <div className="font-semibold">{p.name}</div>
            </div>
            <div className="mt-1 text-sm text-neutral-500">{p.hourlyRate}€/h</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {p.requiredSkills.map((rs) => (
                <span key={rs.skillId} className="rounded bg-neutral-100 px-2 py-0.5 text-xs">
                  {rs.skill.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 text-sm text-neutral-500">
        {skills.length} compétences disponibles : {skills.map((s) => s.name).join(" · ")}
      </div>
    </div>
  );
}
