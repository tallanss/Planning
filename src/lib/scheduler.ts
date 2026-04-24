// Générateur automatique de planning (heuristique gloutonne).
// Objectif : assigner les shifts d'une période aux employés en respectant :
//   - compétences (si le poste exige des compétences)
//   - disponibilités / congés
//   - règles légales (repos 11h, max 10h/jour, max 48h/semaine, etc.)
//   - contrat (heures cibles hebdo)
//   - équité (répartition équilibrée des heures et week-ends)

import type { LaborRuleConfig, RuleShift } from "./labor-rules";
import { checkEmployeeShifts } from "./labor-rules";

export type GenEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  weeklyHours: number;
  skillIds: Set<string>;
  availabilities: { dayOfWeek: number; startMin: number; endMin: number; available: boolean }[];
  timeOffs: { startDate: Date; endDate: Date }[];
  departmentId: string | null;
};

export type GenSlot = {
  id: string;
  start: Date;
  end: Date;
  breakMin: number;
  positionId: string | null;
  departmentId: string | null;
  siteId: string | null;
  requiredSkillIds: Set<string>;
};

export type GenResult = {
  assignments: { slotId: string; employeeId: string | null }[];
  unfilled: string[];
  hoursByEmployee: Record<string, number>;
};

const H_MS = 3_600_000;
const MIN_MS = 60_000;

function isEmployeeAvailable(emp: GenEmployee, slot: GenSlot): boolean {
  for (const to of emp.timeOffs) {
    if (slot.start < to.endDate && slot.end > to.startDate) return false;
  }
  if (emp.availabilities.length === 0) return true;
  const dow = slot.start.getDay();
  const startMin = slot.start.getHours() * 60 + slot.start.getMinutes();
  const endMin = slot.end.getHours() * 60 + slot.end.getMinutes();
  const relevant = emp.availabilities.filter((a) => a.dayOfWeek === dow);
  if (relevant.length === 0) return false;
  const unavailable = relevant.some(
    (a) => !a.available && startMin < a.endMin && endMin > a.startMin,
  );
  if (unavailable) return false;
  const available = relevant.some(
    (a) => a.available && startMin >= a.startMin && endMin <= a.endMin,
  );
  return available;
}

function hasRequiredSkills(emp: GenEmployee, slot: GenSlot): boolean {
  if (slot.requiredSkillIds.size === 0) return true;
  for (const sk of slot.requiredSkillIds) {
    if (!emp.skillIds.has(sk)) return false;
  }
  return true;
}

export function generateSchedule(
  employees: GenEmployee[],
  slots: GenSlot[],
  rules: LaborRuleConfig,
  lockedAssignments: { slotId: string; employeeId: string }[] = [],
): GenResult {
  const assignments: Record<string, string | null> = {};
  const empShifts: Record<string, RuleShift[]> = {};
  const empHours: Record<string, number> = {};
  const empWeekendCount: Record<string, number> = {};

  for (const e of employees) {
    empShifts[e.id] = [];
    empHours[e.id] = 0;
    empWeekendCount[e.id] = 0;
  }

  for (const l of lockedAssignments) {
    const slot = slots.find((s) => s.id === l.slotId);
    if (!slot) continue;
    assignments[l.slotId] = l.employeeId;
    if (!empShifts[l.employeeId]) empShifts[l.employeeId] = [];
    empShifts[l.employeeId].push({
      id: l.slotId,
      employeeId: l.employeeId,
      start: slot.start,
      end: slot.end,
      breakMin: slot.breakMin,
    });
    const hours = (slot.end.getTime() - slot.start.getTime()) / H_MS - slot.breakMin / 60;
    empHours[l.employeeId] = (empHours[l.employeeId] ?? 0) + hours;
    const dow = slot.start.getDay();
    if (dow === 0 || dow === 6) empWeekendCount[l.employeeId] = (empWeekendCount[l.employeeId] ?? 0) + 1;
  }

  const sortedSlots = [...slots]
    .filter((s) => !(s.id in assignments))
    .sort((a, b) => {
      if (a.requiredSkillIds.size !== b.requiredSkillIds.size) {
        return b.requiredSkillIds.size - a.requiredSkillIds.size;
      }
      return a.start.getTime() - b.start.getTime();
    });

  const unfilled: string[] = [];

  for (const slot of sortedSlots) {
    const slotHours = (slot.end.getTime() - slot.start.getTime()) / H_MS - slot.breakMin / 60;
    const candidates = employees.filter((e) => {
      if (!hasRequiredSkills(e, slot)) return false;
      if (!isEmployeeAvailable(e, slot)) return false;
      if (slot.departmentId && e.departmentId && e.departmentId !== slot.departmentId) return false;

      const tentative: RuleShift[] = [
        ...empShifts[e.id],
        {
          employeeId: e.id,
          start: slot.start,
          end: slot.end,
          breakMin: slot.breakMin,
        },
      ];
      const v = checkEmployeeShifts(tentative, rules).filter((x) => x.severity === "error");
      return v.length === 0;
    });

    if (candidates.length === 0) {
      unfilled.push(slot.id);
      assignments[slot.id] = null;
      continue;
    }

    candidates.sort((a, b) => {
      const deficitA = a.weeklyHours - empHours[a.id];
      const deficitB = b.weeklyHours - empHours[b.id];
      if (Math.abs(deficitA - deficitB) > 0.5) return deficitB - deficitA;
      const dow = slot.start.getDay();
      if (dow === 0 || dow === 6) {
        if (empWeekendCount[a.id] !== empWeekendCount[b.id]) {
          return empWeekendCount[a.id] - empWeekendCount[b.id];
        }
      }
      return empHours[a.id] - empHours[b.id];
    });

    const chosen = candidates[0];
    assignments[slot.id] = chosen.id;
    empShifts[chosen.id].push({
      id: slot.id,
      employeeId: chosen.id,
      start: slot.start,
      end: slot.end,
      breakMin: slot.breakMin,
    });
    empHours[chosen.id] += slotHours;
    const dow = slot.start.getDay();
    if (dow === 0 || dow === 6) empWeekendCount[chosen.id]++;
  }

  return {
    assignments: Object.entries(assignments).map(([slotId, employeeId]) => ({ slotId, employeeId })),
    unfilled,
    hoursByEmployee: empHours,
  };
}

export function buildSlotsFromTemplates(
  templates: {
    id: string;
    positionId: string | null;
    startMin: number;
    endMin: number;
    breakMin: number;
    headcount: number;
    daysOfWeek: string;
    requiredSkillIds: string[];
    departmentId?: string | null;
    siteId?: string | null;
  }[],
  startDate: Date,
  endDate: Date,
): GenSlot[] {
  const slots: GenSlot[] = [];
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= endDate) {
    const dow = cursor.getDay();
    for (const t of templates) {
      const days = t.daysOfWeek
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
      if (days.length === 0 || !days.includes(dow)) continue;
      if (t.endMin <= t.startMin) continue; // garde-fou : template invalide
      for (let i = 0; i < t.headcount; i++) {
        const start = new Date(cursor.getTime() + t.startMin * MIN_MS);
        const end = new Date(cursor.getTime() + t.endMin * MIN_MS);
        slots.push({
          id: `${t.id}_${cursor.toISOString().slice(0, 10)}_${i}`,
          start,
          end,
          breakMin: t.breakMin,
          positionId: t.positionId,
          departmentId: t.departmentId ?? null,
          siteId: t.siteId ?? null,
          requiredSkillIds: new Set(t.requiredSkillIds),
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
}
