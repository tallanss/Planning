import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSlotsFromTemplates, generateSchedule, type GenEmployee } from "@/lib/scheduler";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const clearUnlocked: boolean = body.clearUnlocked ?? true;

  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: { company: { include: { rules: true } } },
  });
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const companyId = schedule.companyId;
  const rules = schedule.company.rules[0] ?? {
    minDailyRestH: 11, minWeeklyRestH: 35, maxDailyH: 10, maxWeeklyH: 48,
    maxAvgWeeklyH: 44, breakAfterH: 6, breakMin: 20, maxAmplitudeH: 13, maxConsecDays: 6,
  };

  const templates = await prisma.shiftTemplate.findMany({
    where: { companyId },
    include: { position: { include: { requiredSkills: true } } },
  });

  if (templates.length === 0) {
    return NextResponse.json(
      { ok: false, error: "NO_TEMPLATES", message: "Aucun modèle de shift défini" },
      { status: 400 },
    );
  }

  const employees = await prisma.employee.findMany({
    where: { companyId, active: true },
    include: {
      skills: true,
      availabilities: true,
      timeOffs: { where: { endDate: { gte: schedule.startDate }, startDate: { lte: schedule.endDate } } },
    },
  });

  if (employees.length === 0) {
    return NextResponse.json(
      { ok: false, error: "NO_EMPLOYEES", message: "Aucun employé actif" },
      { status: 400 },
    );
  }

  // On ne supprime JAMAIS les shifts verrouillés. Manager en garde le contrôle.
  if (clearUnlocked) {
    await prisma.shift.deleteMany({ where: { scheduleId: schedule.id, locked: false } });
  }

  // Récupère les shifts restants (verrouillés + ceux encore présents) pour les traiter comme contraintes
  const existingShifts = await prisma.shift.findMany({ where: { scheduleId: schedule.id } });

  const slots = buildSlotsFromTemplates(
    templates.map((t) => ({
      id: t.id,
      positionId: t.positionId,
      startMin: t.startMin,
      endMin: t.endMin,
      breakMin: t.breakMin,
      headcount: t.headcount,
      daysOfWeek: t.daysOfWeek,
      requiredSkillIds: t.position?.requiredSkills.map((rs) => rs.skillId) ?? [],
      departmentId: t.departmentId,
      siteId: t.siteId,
    })),
    schedule.startDate,
    schedule.endDate,
  );

  const genEmployees: GenEmployee[] = employees.map((e) => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    weeklyHours: e.weeklyHours,
    skillIds: new Set(e.skills.map((s) => s.skillId)),
    availabilities: e.availabilities,
    timeOffs: e.timeOffs.map((t) => ({ startDate: t.startDate, endDate: t.endDate })),
    departmentId: e.departmentId,
  }));

  const result = generateSchedule(genEmployees, slots, {
    minDailyRestH: rules.minDailyRestH,
    minWeeklyRestH: rules.minWeeklyRestH,
    maxDailyH: rules.maxDailyH,
    maxWeeklyH: rules.maxWeeklyH,
    breakAfterH: rules.breakAfterH,
    breakMin: rules.breakMin,
    maxAmplitudeH: rules.maxAmplitudeH,
    maxConsecDays: rules.maxConsecDays,
  });

  // Map slot -> template id pour récupérer department/site au moment de la persistance
  const tplById = new Map(templates.map((t) => [t.id, t]));

  const shiftsToCreate = result.assignments
    .map((a) => {
      const slot = slots.find((s) => s.id === a.slotId);
      if (!slot) return null;
      // slot.id = `${template.id}_{date}_{index}` — on extrait le templateId (cuid, sans underscore)
      const tplId = slot.id.split("_")[0];
      const tpl = tplById.get(tplId);
      return {
        scheduleId: schedule.id,
        employeeId: a.employeeId,
        positionId: slot.positionId,
        departmentId: tpl?.departmentId ?? null,
        siteId: tpl?.siteId ?? null,
        start: slot.start,
        end: slot.end,
        breakMin: slot.breakMin,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  if (shiftsToCreate.length > 0) {
    await prisma.shift.createMany({ data: shiftsToCreate });
  }

  return NextResponse.json({
    ok: true,
    created: shiftsToCreate.length,
    unfilled: result.unfilled.length,
    existingLocked: existingShifts.filter((s) => s.locked).length,
    hoursByEmployee: result.hoursByEmployee,
  });
}
