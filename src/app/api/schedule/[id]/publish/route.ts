import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const schedule = await prisma.schedule.update({
    where: { id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  return NextResponse.json(schedule);
}
