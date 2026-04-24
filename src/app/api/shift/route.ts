import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateShift = z.object({
  scheduleId: z.string(),
  employeeId: z.string().nullable().optional(),
  positionId: z.string().nullable().optional(),
  departmentId: z.string().nullable().optional(),
  start: z.string(),
  end: z.string(),
  breakMin: z.number().int().min(0).default(0),
  note: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = CreateShift.parse(body);
  const shift = await prisma.shift.create({
    data: {
      scheduleId: data.scheduleId,
      employeeId: data.employeeId ?? null,
      positionId: data.positionId ?? null,
      departmentId: data.departmentId ?? null,
      start: new Date(data.start),
      end: new Date(data.end),
      breakMin: data.breakMin,
      note: data.note ?? null,
    },
  });
  return NextResponse.json(shift);
}
