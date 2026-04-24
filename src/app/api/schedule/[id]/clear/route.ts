import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.shift.deleteMany({ where: { scheduleId: id, locked: false } });
  return NextResponse.json({ ok: true });
}
