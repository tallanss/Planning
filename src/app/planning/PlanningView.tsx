"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, DAY_LABELS_FR, DAY_LABELS_FR_SHORT, formatHours, minutesToHHMM } from "@/lib/utils";
import { checkAll, type LaborRuleConfig } from "@/lib/labor-rules";

// Types simplifiés (côté client, sans Prisma types)
type Shift = {
  id: string;
  scheduleId: string;
  employeeId: string | null;
  positionId: string | null;
  departmentId: string | null;
  start: string;
  end: string;
  breakMin: number;
  note: string | null;
  locked: boolean;
};
type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  color: string;
  weeklyHours: number;
  departmentId: string | null;
  contractType: string;
  department?: { id: string; name: string; color: string } | null;
  timeOffs: { id: string; startDate: string; endDate: string; kind: string }[];
};
type Position = { id: string; name: string; color: string };
type Department = { id: string; name: string; color: string; site?: { name: string } | null };
type Schedule = { id: string; name: string; startDate: string; endDate: string; status: string };
type CompanyWithRules = { id: string; name: string; rules: LaborRuleConfig[] };

export default function PlanningView({
  company,
  schedule,
  shifts: initialShifts,
  employees,
  positions,
  departments,
  templates,
  periodStart,
  periodEnd,
}: {
  company: CompanyWithRules;
  schedule: Schedule;
  shifts: Shift[];
  employees: Employee[];
  positions: Position[];
  departments: Department[];
  templates: { id: string; name: string }[];
  periodStart: string;
  periodEnd: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [toast, setToast] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const start = useMemo(() => new Date(periodStart), [periodStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);

  const rules: LaborRuleConfig = company.rules[0] ?? {
    minDailyRestH: 11, minWeeklyRestH: 35, maxDailyH: 10, maxWeeklyH: 48,
    breakAfterH: 6, breakMin: 20, maxAmplitudeH: 13, maxConsecDays: 6,
  };

  const visibleEmployees = useMemo(() => {
    if (selectedDept === "ALL") return employees;
    return employees.filter((e) => e.departmentId === selectedDept);
  }, [employees, selectedDept]);

  const shiftsByEmployee = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shifts) {
      if (!s.employeeId) continue;
      if (!map.has(s.employeeId)) map.set(s.employeeId, []);
      map.get(s.employeeId)!.push(s);
    }
    return map;
  }, [shifts]);

  const unassignedShifts = useMemo(
    () => shifts.filter((s) => !s.employeeId),
    [shifts],
  );

  const violations = useMemo(() => {
    const ruleShifts = shifts
      .filter((s) => s.employeeId)
      .map((s) => ({
        id: s.id,
        employeeId: s.employeeId,
        start: new Date(s.start),
        end: new Date(s.end),
        breakMin: s.breakMin,
      }));
    return checkAll(ruleShifts, rules);
  }, [shifts, rules]);

  const totalHoursByEmp = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of shifts) {
      if (!s.employeeId) continue;
      const h =
        (new Date(s.end).getTime() - new Date(s.start).getTime()) / 3_600_000 - s.breakMin / 60;
      map.set(s.employeeId, (map.get(s.employeeId) ?? 0) + h);
    }
    return map;
  }, [shifts]);

  const totalCompanyHours = useMemo(
    () => Array.from(totalHoursByEmp.values()).reduce((a, b) => a + b, 0),
    [totalHoursByEmp],
  );
  const filledRatio = shifts.length
    ? shifts.filter((s) => s.employeeId).length / shifts.length
    : 0;

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/schedule/${schedule.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepLocked: true, clearExisting: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setToast(
          `✓ ${data.created} shifts générés${data.unfilled ? ` · ${data.unfilled} non pourvus` : ""}`,
        );
        startTransition(() => router.refresh());
      } else {
        setToast("Erreur de génération");
      }
    } finally {
      setGenerating(false);
      setTimeout(() => setToast(null), 3500);
    }
  }

  async function handleClear() {
    if (!confirm("Supprimer tous les shifts non verrouillés ?")) return;
    await fetch(`/api/schedule/${schedule.id}/clear`, { method: "POST" });
    startTransition(() => router.refresh());
  }

  async function handlePublish() {
    await fetch(`/api/schedule/${schedule.id}/publish`, { method: "POST" });
    setToast("✓ Planning publié");
    startTransition(() => router.refresh());
    setTimeout(() => setToast(null), 3500);
  }

  async function deleteShift(id: string) {
    setShifts((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/shift/${id}`, { method: "DELETE" });
  }

  async function toggleLock(id: string, locked: boolean) {
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, locked: !locked } : s)));
    await fetch(`/api/shift/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked: !locked }),
    });
  }

  function navigateWeek(offset: number) {
    const newStart = addDays(start, offset * 7);
    router.push(`/planning?start=${newStart.toISOString()}`);
  }

  function exportXlsx() {
    window.open(`/api/export/xlsx?scheduleId=${schedule.id}`, "_blank");
  }
  function exportPdf() {
    window.open(`/api/export/pdf?scheduleId=${schedule.id}`, "_blank");
  }

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-4">
      {/* Barre supérieure : nav semaine + stats + actions */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateWeek(-1)}
            className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm hover:bg-neutral-50"
          >
            ←
          </button>
          <div className="min-w-[260px]">
            <div className="text-xs text-neutral-500">{schedule.status === "PUBLISHED" ? "Publié" : "Brouillon"}</div>
            <div className="text-lg font-semibold">
              Semaine du {start.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          <button
            onClick={() => navigateWeek(1)}
            className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm hover:bg-neutral-50"
          >
            →
          </button>
          <button
            onClick={() => router.push("/planning")}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Aujourd&apos;hui
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm"
          >
            <option value="ALL">Tous les départements</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.site?.name ? `${d.site.name} — ` : ""}{d.name}
              </option>
            ))}
          </select>
          <button
            onClick={exportXlsx}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Excel
          </button>
          <button
            onClick={exportPdf}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            PDF
          </button>
          <button
            onClick={handleClear}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Vider
          </button>
          <button
            onClick={handlePublish}
            disabled={schedule.status === "PUBLISHED"}
            className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50"
          >
            Publier
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || pending}
            className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {generating ? "Génération…" : "⚡ Générer le planning"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Employés" value={visibleEmployees.length.toString()} />
        <StatCard label="Shifts" value={shifts.length.toString()} />
        <StatCard
          label="Taux de couverture"
          value={`${Math.round(filledRatio * 100)}%`}
          tone={filledRatio >= 0.95 ? "ok" : filledRatio >= 0.8 ? "warn" : "err"}
        />
        <StatCard label="Heures totales" value={formatHours(totalCompanyHours)} />
        <StatCard
          label="Conflits légaux"
          value={Array.from(violations.values()).reduce((a, b) => a + b.length, 0).toString()}
          tone={violations.size === 0 ? "ok" : "err"}
        />
      </div>

      {/* Slots non pourvus */}
      {unassignedShifts.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-amber-900">
              ⚠ {unassignedShifts.length} shift(s) non pourvu(s)
            </div>
            <div className="text-xs text-amber-700">Ajustez disponibilités ou ajoutez du personnel</div>
          </div>
        </div>
      )}

      {/* Grille planning */}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm scrollbar-thin">
        <table className="w-full min-w-[1100px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[220px]" />
            {days.map((_, i) => (
              <col key={i} />
            ))}
            <col className="w-[110px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="p-3">Employé</th>
              {days.map((d, i) => (
                <th key={i} className="p-3 font-medium">
                  <div className="text-neutral-900 normal-case text-sm">{DAY_LABELS_FR_SHORT[d.getDay()]} {d.getDate()}</div>
                  <div className="text-[10px] uppercase">{d.toLocaleDateString("fr-FR", { month: "short" })}</div>
                </th>
              ))}
              <th className="p-3 text-right">Heures</th>
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map((emp) => {
              const empShifts = shiftsByEmployee.get(emp.id) ?? [];
              const empViolations = violations.get(emp.id) ?? [];
              const totalH = totalHoursByEmp.get(emp.id) ?? 0;
              const deficit = emp.weeklyHours - totalH;
              return (
                <tr key={emp.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: emp.color }}
                      />
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {emp.firstName} {emp.lastName}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                          <span>{emp.contractType} · {emp.weeklyHours}h</span>
                          {empViolations.length > 0 && (
                            <span
                              title={empViolations.map((v) => v.message).join("\n")}
                              className="rounded bg-red-100 px-1 text-red-700"
                            >
                              ⚠ {empViolations.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  {days.map((d, di) => {
                    const dayShifts = empShifts.filter((s) => {
                      const sd = new Date(s.start);
                      return (
                        sd.getFullYear() === d.getFullYear() &&
                        sd.getMonth() === d.getMonth() &&
                        sd.getDate() === d.getDate()
                      );
                    });
                    const onTimeOff = emp.timeOffs.some((to) => {
                      const td = new Date(to.startDate);
                      const te = new Date(to.endDate);
                      return d >= td && d <= te;
                    });
                    return (
                      <td
                        key={di}
                        className={`p-1 align-top ${onTimeOff ? "bg-neutral-100" : ""}`}
                      >
                        {onTimeOff && dayShifts.length === 0 ? (
                          <div className="rounded bg-neutral-200 px-2 py-1 text-center text-[11px] text-neutral-600">
                            Congé
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {dayShifts.map((s) => (
                              <ShiftPill
                                key={s.id}
                                shift={s}
                                position={positions.find((p) => p.id === s.positionId)}
                                onDelete={() => deleteShift(s.id)}
                                onToggleLock={() => toggleLock(s.id, s.locked)}
                              />
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right">
                    <div className={`text-sm font-medium ${deficit < -0.5 ? "text-red-600" : deficit > 0.5 ? "text-amber-600" : "text-neutral-900"}`}>
                      {formatHours(totalH)}
                    </div>
                    <div className="text-[11px] text-neutral-500">
                      {deficit > 0.5
                        ? `-${formatHours(deficit)}`
                        : deficit < -0.5
                          ? `+${formatHours(-deficit)}`
                          : "✓"}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "ok" | "warn" | "err" | "neutral" }) {
  const colors = {
    ok: "text-emerald-700",
    warn: "text-amber-700",
    err: "text-red-700",
    neutral: "text-neutral-900",
  }[tone];
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${colors}`}>{value}</div>
    </div>
  );
}

function ShiftPill({
  shift,
  position,
  onDelete,
  onToggleLock,
}: {
  shift: Shift;
  position?: Position;
  onDelete: () => void;
  onToggleLock: () => void;
}) {
  const start = new Date(shift.start);
  const end = new Date(shift.end);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  const color = position?.color ?? "#64748b";
  return (
    <div
      className="group relative rounded border-l-4 bg-white px-1.5 py-1 text-[11px] leading-tight shadow-sm hover:shadow"
      style={{ borderLeftColor: color }}
      title={`${position?.name ?? "Shift"} · ${minutesToHHMM(startMin)}-${minutesToHHMM(endMin)}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium text-neutral-800 truncate">
          {minutesToHHMM(startMin)}–{minutesToHHMM(endMin)}
        </span>
        {shift.locked && <span title="Verrouillé">🔒</span>}
      </div>
      <div className="truncate text-neutral-500">{position?.name ?? "—"}</div>
      <div className="absolute right-0.5 top-0.5 hidden gap-0.5 group-hover:flex">
        <button
          onClick={onToggleLock}
          className="rounded bg-white/90 px-1 text-[10px] hover:bg-neutral-100"
          title={shift.locked ? "Déverrouiller" : "Verrouiller"}
        >
          {shift.locked ? "🔓" : "🔒"}
        </button>
        <button
          onClick={onDelete}
          className="rounded bg-white/90 px-1 text-[10px] hover:bg-red-50"
          title="Supprimer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
