import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateEmployee = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  contractType: z.string().optional(),
  weeklyHours: z.number().optional(),
  hourlyRate: z.number().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const data = UpdateEmployee.parse(await req.json());
  const emp = await prisma.employee.update({ where: { id }, data });
  return NextResponse.json(emp);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.employee.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
