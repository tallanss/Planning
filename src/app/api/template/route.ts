import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const Create = z
  .object({
    name: z.string().min(1),
    positionId: z.string().nullable().optional(),
    departmentId: z.string().nullable().optional(),
    siteId: z.string().nullable().optional(),
    startMin: z.number().int().min(0).max(24 * 60),
    endMin: z.number().int().min(0).max(24 * 60),
    breakMin: z.number().int().min(0).default(0),
    headcount: z.number().int().min(1).max(500).default(1),
    daysOfWeek: z
      .string()
      .refine(
        (s) => s.split(",").every((x) => /^\s*[0-6]\s*$/.test(x)) && s.trim().length > 0,
        "daysOfWeek invalide",
      ),
  })
  .refine((v) => v.endMin > v.startMin, {
    message: "L'heure de fin doit être après l'heure de début",
    path: ["endMin"],
  });

export async function POST(req: NextRequest) {
  const parsed = Create.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }
  const company = await prisma.company.findFirst();
  if (!company) return NextResponse.json({ error: "No company" }, { status: 404 });
  const t = await prisma.shiftTemplate.create({
    data: { ...parsed.data, companyId: company.id },
  });
  return NextResponse.json(t);
}
