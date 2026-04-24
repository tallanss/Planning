import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startOfWeek, addDays } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start");
  const company = await prisma.company.findFirst({ include: { rules: true } });
  if (!company) return NextResponse.json({ error: "No company" }, { status: 404 });

  const start = startParam ? new Date(startParam) : startOfWeek(new Date());
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, 7);
  end.setMilliseconds(-1);

  let schedule = await prisma.schedule.findFirst({
    where: {
      companyId: company.id,
      startDate: { lte: end },
      endDate: { gte: start },
    },
    orderBy: { startDate: "desc" },
  });

  if (!schedule) {
    schedule = await prisma.schedule.create({
      data: {
        companyId: company.id,
        name: `Semaine du ${start.toLocaleDateString("fr-FR")}`,
        startDate: start,
        endDate: end,
        status: "DRAFT",
      },
    });
  }

  const shifts = await prisma.shift.findMany({
    where: { scheduleId: schedule.id },
    orderBy: { start: "asc" },
  });

  const employees = await prisma.employee.findMany({
    where: { companyId: company.id, active: true },
    include: {
      department: true,
      skills: { include: { skill: true } },
      availabilities: true,
      timeOffs: { where: { endDate: { gte: start }, startDate: { lte: end } } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const positions = await prisma.position.findMany({
    where: { companyId: company.id },
    include: { requiredSkills: true },
  });

  const departments = await prisma.department.findMany({
    where: { companyId: company.id },
    include: { site: true },
  });

  return NextResponse.json({
    company,
    schedule,
    shifts,
    employees,
    positions,
    departments,
    periodStart: start,
    periodEnd: end,
  });
}
