import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateShift = z.object({
  employeeId: z.string().nullable().optional(),
  positionId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  breakMin: z.number().int().min(0).optional(),
  note: z.string().nullable().optional(),
  locked: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const data = UpdateShift.parse(body);
  const shift = await prisma.shift.update({
    where: { id },
    data: {
      ...("employeeId" in data ? { employeeId: data.employeeId } : {}),
      ...("positionId" in data ? { positionId: data.positionId } : {}),
      ...("departmentId" in data ? { departmentId: data.departmentId } : {}),
      ...(data.start ? { start: new Date(data.start) } : {}),
      ...(data.end ? { end: new Date(data.end) } : {}),
      ...(data.breakMin !== undefined ? { breakMin: data.breakMin } : {}),
      ...("note" in data ? { note: data.note } : {}),
      ...(data.locked !== undefined ? { locked: data.locked } : {}),
    },
  });
  return NextResponse.json(shift);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.shift.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
