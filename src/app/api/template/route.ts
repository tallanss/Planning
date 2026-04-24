import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const Create = z.object({
  name: z.string(),
  positionId: z.string().nullable().optional(),
  startMin: z.number().int().min(0).max(24 * 60),
  endMin: z.number().int().min(0).max(24 * 60),
  breakMin: z.number().int().min(0).default(0),
  headcount: z.number().int().min(1).default(1),
  daysOfWeek: z.string().default("1,2,3,4,5"),
});

export async function POST(req: NextRequest) {
  const data = Create.parse(await req.json());
  const company = await prisma.company.findFirst();
  if (!company) return NextResponse.json({ error: "No company" }, { status: 404 });
  const t = await prisma.shiftTemplate.create({ data: { ...data, companyId: company.id } });
  return NextResponse.json(t);
}
