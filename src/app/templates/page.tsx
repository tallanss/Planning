import { prisma } from "@/lib/prisma";
import TemplatesView from "./TemplatesView";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const company = await prisma.company.findFirst();
  if (!company) return <div className="p-8">Aucune entreprise.</div>;
  const [templates, positions] = await Promise.all([
    prisma.shiftTemplate.findMany({
      where: { companyId: company.id },
      include: { position: true },
      orderBy: { startMin: "asc" },
    }),
    prisma.position.findMany({ where: { companyId: company.id } }),
  ]);
  return (
    <TemplatesView
      templates={JSON.parse(JSON.stringify(templates))}
      positions={JSON.parse(JSON.stringify(positions))}
    />
  );
}
