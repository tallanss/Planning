import { prisma } from "@/lib/prisma";
import TemplatesView from "./TemplatesView";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const company = await prisma.company.findFirst();
  if (!company) return <div className="p-8">Aucune entreprise.</div>;
  const [templates, positions, departments] = await Promise.all([
    prisma.shiftTemplate.findMany({
      where: { companyId: company.id },
      include: { position: true, department: true, site: true },
      orderBy: { startMin: "asc" },
    }),
    prisma.position.findMany({ where: { companyId: company.id } }),
    prisma.department.findMany({ where: { companyId: company.id }, include: { site: true } }),
  ]);
  return (
    <TemplatesView
      templates={JSON.parse(JSON.stringify(templates))}
      positions={JSON.parse(JSON.stringify(positions))}
      departments={JSON.parse(JSON.stringify(departments))}
    />
  );
}
