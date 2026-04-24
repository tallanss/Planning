// Vérification des contraintes légales sur un ensemble de shifts
// Règles françaises par défaut (configurables via LaborRule).

export type RuleShift = {
  id?: string;
  employeeId: string | null;
  start: Date;
  end: Date;
  breakMin: number;
};

export type LaborRuleConfig = {
  minDailyRestH: number;
  minWeeklyRestH: number;
  maxDailyH: number;
  maxWeeklyH: number;
  breakAfterH: number;
  breakMin: number;
  maxAmplitudeH: number;
  maxConsecDays: number;
};

export type Violation = {
  kind:
    | "OVERLAP"
    | "DAILY_REST"
    | "WEEKLY_REST"
    | "MAX_DAILY"
    | "MAX_WEEKLY"
    | "BREAK"
    | "AMPLITUDE"
    | "CONSEC_DAYS";
  message: string;
  shiftIds: (string | undefined)[];
  severity: "error" | "warning";
};

const DAY_MS = 86_400_000;
const H_MS = 3_600_000;

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isoWeekKey(d: Date) {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((tmp.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${weekNum}`;
}

export function checkEmployeeShifts(
  shifts: RuleShift[],
  rules: LaborRuleConfig,
): Violation[] {
  const violations: Violation[] = [];
  const sorted = [...shifts].sort((a, b) => a.start.getTime() - b.start.getTime());

  // 1. Chevauchements
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (b.start < a.end) {
      violations.push({
        kind: "OVERLAP",
        message: "Chevauchement de shifts",
        shiftIds: [a.id, b.id],
        severity: "error",
      });
    }
  }

  // 2. Repos quotidien entre deux shifts consécutifs
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const restH = (b.start.getTime() - a.end.getTime()) / H_MS;
    if (restH > 0 && restH < rules.minDailyRestH) {
      violations.push({
        kind: "DAILY_REST",
        message: `Repos quotidien < ${rules.minDailyRestH}h (${restH.toFixed(1)}h)`,
        shiftIds: [a.id, b.id],
        severity: "error",
      });
    }
  }

  // 3. Max h/jour + amplitude + pause
  const byDay = new Map<string, RuleShift[]>();
  for (const s of sorted) {
    const k = dayKey(s.start);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(s);
  }
  for (const dayShifts of byDay.values()) {
    let workH = 0;
    let minStart = dayShifts[0].start;
    let maxEnd = dayShifts[0].end;
    for (const s of dayShifts) {
      workH += (s.end.getTime() - s.start.getTime()) / H_MS - s.breakMin / 60;
      if (s.start < minStart) minStart = s.start;
      if (s.end > maxEnd) maxEnd = s.end;

      if (
        (s.end.getTime() - s.start.getTime()) / H_MS > rules.breakAfterH &&
        s.breakMin < rules.breakMin
      ) {
        violations.push({
          kind: "BREAK",
          message: `Pause < ${rules.breakMin}min pour un shift > ${rules.breakAfterH}h`,
          shiftIds: [s.id],
          severity: "warning",
        });
      }
    }
    if (workH > rules.maxDailyH) {
      violations.push({
        kind: "MAX_DAILY",
        message: `> ${rules.maxDailyH}h travaillées dans la journée (${workH.toFixed(1)}h)`,
        shiftIds: dayShifts.map((s) => s.id),
        severity: "error",
      });
    }
    const amplitudeH = (maxEnd.getTime() - minStart.getTime()) / H_MS;
    if (amplitudeH > rules.maxAmplitudeH) {
      violations.push({
        kind: "AMPLITUDE",
        message: `Amplitude > ${rules.maxAmplitudeH}h (${amplitudeH.toFixed(1)}h)`,
        shiftIds: dayShifts.map((s) => s.id),
        severity: "warning",
      });
    }
  }

  // 4. Max h/semaine
  const byWeek = new Map<string, RuleShift[]>();
  for (const s of sorted) {
    const k = isoWeekKey(s.start);
    if (!byWeek.has(k)) byWeek.set(k, []);
    byWeek.get(k)!.push(s);
  }
  for (const weekShifts of byWeek.values()) {
    const total = weekShifts.reduce(
      (acc, s) => acc + (s.end.getTime() - s.start.getTime()) / H_MS - s.breakMin / 60,
      0,
    );
    if (total > rules.maxWeeklyH) {
      violations.push({
        kind: "MAX_WEEKLY",
        message: `> ${rules.maxWeeklyH}h dans la semaine (${total.toFixed(1)}h)`,
        shiftIds: weekShifts.map((s) => s.id),
        severity: "error",
      });
    }
  }

  // 5. Jours consécutifs max
  const days = Array.from(byDay.keys())
    .map((k) => {
      const [y, m, d] = k.split("-").map(Number);
      return new Date(y, m, d);
    })
    .sort((a, b) => a.getTime() - b.getTime());
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((days[i].getTime() - days[i - 1].getTime()) / DAY_MS);
    if (diff === 1) {
      streak++;
      if (streak > rules.maxConsecDays) {
        violations.push({
          kind: "CONSEC_DAYS",
          message: `> ${rules.maxConsecDays} jours consécutifs travaillés`,
          shiftIds: [],
          severity: "warning",
        });
      }
    } else {
      streak = 1;
    }
  }

  // 6. Repos hebdomadaire : cherche un gap >= minWeeklyRestH sur chaque semaine
  for (const [, weekShifts] of byWeek) {
    const ws = [...weekShifts].sort((a, b) => a.start.getTime() - b.start.getTime());
    let maxGap = 0;
    for (let i = 0; i < ws.length - 1; i++) {
      const gap = (ws[i + 1].start.getTime() - ws[i].end.getTime()) / H_MS;
      if (gap > maxGap) maxGap = gap;
    }
    if (ws.length >= 6 && maxGap < rules.minWeeklyRestH) {
      violations.push({
        kind: "WEEKLY_REST",
        message: `Repos hebdo < ${rules.minWeeklyRestH}h (max ${maxGap.toFixed(1)}h)`,
        shiftIds: ws.map((s) => s.id),
        severity: "error",
      });
    }
  }

  return violations;
}

export function checkAll(
  shifts: RuleShift[],
  rules: LaborRuleConfig,
): Map<string, Violation[]> {
  const byEmp = new Map<string, RuleShift[]>();
  for (const s of shifts) {
    if (!s.employeeId) continue;
    if (!byEmp.has(s.employeeId)) byEmp.set(s.employeeId, []);
    byEmp.get(s.employeeId)!.push(s);
  }
  const result = new Map<string, Violation[]>();
  for (const [empId, emps] of byEmp) {
    const v = checkEmployeeShifts(emps, rules);
    if (v.length) result.set(empId, v);
  }
  return result;
}
