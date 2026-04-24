import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const Update = z
  .object({
    name: z.string().min(1).optional(),
    positionId: z.string().nullable().optional(),
    departmentId: z.string().nullable().optional(),
    siteId: z.string().nullable().optional(),
    startMin: z.number().int().min(0).max(24 * 60).optional(),
    endMin: z.number().int().min(0).max(24 * 60).optional(),
    breakMin: z.number().int().min(0).optional(),
    headcount: z.number().int().min(1).max(500).optional(),
    daysOfWeek: z
      .string()
      .optional()
      .refine(
        (s) => s === undefined || (s.split(",").every((x) => /^\s*[0-6]\s*$/.test(x)) && s.trim().length > 0),
        "daysOfWeek invalide",
      ),
  })
  .refine(
    (v) => v.startMin === undefined || v.endMin === undefined || v.endMin > v.startMin,
    { message: "L'heure de fin doit être après l'heure de début", path: ["endMin"] },
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = Update.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }
  const t = await prisma.shiftTemplate.update({ where: { id }, data: parsed.data });
  return NextResponse.json(t);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.shiftTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
