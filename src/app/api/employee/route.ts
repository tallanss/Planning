import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateEmployee = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  contractType: z.string().default("CDI"),
  weeklyHours: z.number().default(35),
  hourlyRate: z.number().default(0),
  skillIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = CreateEmployee.parse(body);
  const company = await prisma.company.findFirst();
  if (!company) return NextResponse.json({ error: "No company" }, { status: 404 });

  const employee = await prisma.employee.create({
    data: {
      companyId: company.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      departmentId: data.departmentId ?? null,
      contractType: data.contractType,
      weeklyHours: data.weeklyHours,
      hourlyRate: data.hourlyRate,
      skills: data.skillIds
        ? { create: data.skillIds.map((id) => ({ skillId: id, level: 3 })) }
        : undefined,
      availabilities: {
        create: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
          dayOfWeek: dow,
          startMin: 8 * 60,
          endMin: 23 * 60,
          available: true,
        })),
      },
    },
  });
  return NextResponse.json(employee);
}
