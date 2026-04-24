import { prisma } from "@/lib/prisma";
import { startOfWeek, addDays } from "@/lib/utils";
import PlanningView from "./PlanningView";

export const dynamic = "force-dynamic";

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>;
}) {
  const { start } = await searchParams;
  const company = await prisma.company.findFirst({ include: { rules: true } });
  if (!company) {
    return (
      <div className="p-12 text-center text-neutral-500">
        Aucune entreprise. Lancez <code className="mx-1 rounded bg-neutral-200 px-2 py-0.5">pnpm db:seed</code>.
      </div>
    );
  }

  const periodStart = start ? new Date(start) : startOfWeek(new Date());
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = addDays(periodStart, 7);
  periodEnd.setMilliseconds(-1);

  let schedule = await prisma.schedule.findFirst({
    where: {
      companyId: company.id,
      startDate: { lte: periodEnd },
      endDate: { gte: periodStart },
    },
    orderBy: { startDate: "desc" },
  });

  if (!schedule) {
    schedule = await prisma.schedule.create({
      data: {
        companyId: company.id,
        name: `Semaine du ${periodStart.toLocaleDateString("fr-FR")}`,
        startDate: periodStart,
        endDate: periodEnd,
        status: "DRAFT",
      },
    });
  }

  const [shifts, employees, positions, departments, templates] = await Promise.all([
    prisma.shift.findMany({ where: { scheduleId: schedule.id }, orderBy: { start: "asc" } }),
    prisma.employee.findMany({
      where: { companyId: company.id, active: true },
      include: {
        department: true,
        skills: { include: { skill: true } },
        timeOffs: { where: { endDate: { gte: periodStart }, startDate: { lte: periodEnd } } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.position.findMany({ where: { companyId: company.id } }),
    prisma.department.findMany({ where: { companyId: company.id }, include: { site: true } }),
    prisma.shiftTemplate.findMany({ where: { companyId: company.id } }),
  ]);

  return (
    <PlanningView
      company={JSON.parse(JSON.stringify(company))}
      schedule={JSON.parse(JSON.stringify(schedule))}
      shifts={JSON.parse(JSON.stringify(shifts))}
      employees={JSON.parse(JSON.stringify(employees))}
      positions={JSON.parse(JSON.stringify(positions))}
      departments={JSON.parse(JSON.stringify(departments))}
      templates={JSON.parse(JSON.stringify(templates))}
      periodStart={periodStart.toISOString()}
      periodEnd={periodEnd.toISOString()}
    />
  );
}
