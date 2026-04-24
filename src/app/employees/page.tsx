import { prisma } from "@/lib/prisma";
import EmployeesView from "./EmployeesView";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const company = await prisma.company.findFirst();
  if (!company) return <div className="p-8">Aucune entreprise.</div>;

  const [employees, departments, skills] = await Promise.all([
    prisma.employee.findMany({
      where: { companyId: company.id },
      include: { department: true, skills: { include: { skill: true } } },
      orderBy: [{ active: "desc" }, { lastName: "asc" }],
    }),
    prisma.department.findMany({ where: { companyId: company.id } }),
    prisma.skill.findMany({ where: { companyId: company.id } }),
  ]);

  return (
    <EmployeesView
      employees={JSON.parse(JSON.stringify(employees))}
      departments={JSON.parse(JSON.stringify(departments))}
      skills={JSON.parse(JSON.stringify(skills))}
    />
  );
}
