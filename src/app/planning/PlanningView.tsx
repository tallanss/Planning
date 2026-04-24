"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDays, DAY_LABELS_FR_SHORT, formatHours, minutesToHHMM } from "@/lib/utils";
import { checkAll, type LaborRuleConfig } from "@/lib/labor-rules";
import ShiftEditor from "./ShiftEditor";

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
type Department = { id: string; name: string; color: string; siteId: string | null; site?: { name: string } | null };
type Schedule = { id: string; name: string; startDate: string; endDate: string; status: string };
type CompanyWithRules = { id: string; name: string; rules: LaborRuleConfig[] };

type EditorState =
  | { mode: "closed" }
  | { mode: "edit"; shift: Shift }
  | { mode: "create"; date: Date; employeeId: string | null };

export default function PlanningView({
  company,
  schedule,
  shifts,
  employees,
  positions,
  departments,
  periodStart,
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
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [toast, setToast] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [showUnfilled, setShowUnfilled] = useState(false);

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
    () => shifts.filter((s) => !s.employeeId).sort((a, b) => a.start.localeCompare(b.start)),
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
        body: JSON.stringify({ clearUnlocked: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setToast(
          `✓ ${data.created} shifts générés${data.unfilled ? ` · ${data.unfilled} non pourvus` : ""}${data.existingLocked ? ` · ${data.existingLocked} verrouillés conservés` : ""}`,
        );
        startTransition(() => router.refresh());
      } else {
        setToast(`⚠ ${data.message ?? "Erreur de génération"}`);
      }
    } catch {
      setToast("⚠ Erreur réseau");
    } finally {
      setGenerating(false);
      setTimeout(() => setToast(null), 4500);
    }
  }

  async function handleClear() {
    if (!confirm("Supprimer tous les shifts non verrouillés ? Les shifts verrouillés 🔒 sont conservés.")) return;
    const res = await fetch(`/api/schedule/${schedule.id}/clear`, { method: "POST" });
    if (res.ok) {
      setToast("✓ Shifts non verrouillés supprimés");
      startTransition(() => router.refresh());
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function handlePublish() {
    const res = await fetch(`/api/schedule/${schedule.id}/publish`, { method: "POST" });
    if (res.ok) {
      setToast("✓ Planning publié");
      startTransition(() => router.refresh());
      setTimeout(() => setToast(null), 3000);
    }
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

  function openCreate(date: Date, employeeId: string | null) {
    setEditor({ mode: "create", date, employeeId });
  }
  function openEdit(s: Shift) {
    setEditor({ mode: "edit", shift: s });
  }

  const editorDraft = useMemo(() => {
    if (editor.mode === "closed") return null;
    if (editor.mode === "edit") {
      return {
        id: editor.shift.id,
        start: new Date(editor.shift.start),
        end: new Date(editor.shift.end),
        breakMin: editor.shift.breakMin,
        employeeId: editor.shift.employeeId,
        positionId: editor.shift.positionId,
        departmentId: editor.shift.departmentId,
        note: editor.shift.note,
        locked: editor.shift.locked,
      };
    }
    // create : par défaut 9h-17h sur la date cliquée
    const s = new Date(editor.date);
    s.setHours(9, 0, 0, 0);
    const e = new Date(editor.date);
    e.setHours(17, 0, 0, 0);
    const emp = employees.find((x) => x.id === editor.employeeId);
    return {
      start: s,
      end: e,
      breakMin: 30,
      employeeId: editor.employeeId,
      positionId: null as string | null,
      departmentId: emp?.departmentId ?? null,
    };
  }, [editor, employees]);

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigateWeek(-1)} className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm hover:bg-neutral-50">←</button>
          <div className="min-w-[260px]">
            <div className="text-xs text-neutral-500">
              {schedule.status === "PUBLISHED" ? "Publié" : "Brouillon"}
            </div>
            <div className="text-lg font-semibold">
              Semaine du {start.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          <button onClick={() => navigateWeek(1)} className="rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm hover:bg-neutral-50">→</button>
          <button onClick={() => router.push("/planning")} className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">Aujourd&apos;hui</button>
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
          <button onClick={exportXlsx} className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">Excel</button>
          <button onClick={exportPdf} className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">PDF</button>
          <button onClick={handleClear} className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50">Vider</button>
          <button onClick={handlePublish} disabled={schedule.status === "PUBLISHED"} className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50">Publier</button>
          <button onClick={handleGenerate} disabled={generating || pending} className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50">
            {generating ? "Génération…" : "⚡ Générer le planning"}
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Employés" value={visibleEmployees.length.toString()} />
        <StatCard label="Shifts" value={shifts.length.toString()} />
        <StatCard label="Taux de couverture" value={`${Math.round(filledRatio * 100)}%`} tone={filledRatio >= 0.95 ? "ok" : filledRatio >= 0.8 ? "warn" : "err"} />
        <StatCard label="Heures totales" value={formatHours(totalCompanyHours)} />
        <StatCard label="Conflits légaux" value={Array.from(violations.values()).reduce((a, b) => a + b.length, 0).toString()} tone={violations.size === 0 ? "ok" : "err"} />
      </div>

      {unassignedShifts.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50">
          <button
            onClick={() => setShowUnfilled((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-left"
          >
            <span className="text-sm font-medium text-amber-900">
              ⚠ {unassignedShifts.length} shift(s) non pourvu(s) — cliquez pour {showUnfilled ? "masquer" : "voir"} le détail
            </span>
            <span className="text-amber-700">{showUnfilled ? "▴" : "▾"}</span>
          </button>
          {showUnfilled && (
            <div className="max-h-64 overflow-y-auto border-t border-amber-200 p-2">
              <table className="w-full text-xs">
                <thead className="text-amber-900">
                  <tr>
                    <th className="px-2 py-1 text-left">Date</th>
                    <th className="px-2 py-1 text-left">Horaires</th>
                    <th className="px-2 py-1 text-left">Poste</th>
                    <th className="px-2 py-1 text-left">Département</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {unassignedShifts.map((s) => {
                    const st = new Date(s.start);
                    const et = new Date(s.end);
                    const pos = positions.find((p) => p.id === s.positionId);
                    const dep = departments.find((d) => d.id === s.departmentId);
                    return (
                      <tr key={s.id} className="border-t border-amber-100">
                        <td className="px-2 py-1">{st.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</td>
                        <td className="px-2 py-1 font-medium">
                          {minutesToHHMM(st.getHours() * 60 + st.getMinutes())}–{minutesToHHMM(et.getHours() * 60 + et.getMinutes())}
                        </td>
                        <td className="px-2 py-1">{pos?.name ?? "—"}</td>
                        <td className="px-2 py-1">{dep?.name ?? "—"}</td>
                        <td className="px-2 py-1 text-right">
                          <button onClick={() => openEdit(s)} className="rounded border border-amber-300 px-2 py-0.5 text-amber-900 hover:bg-amber-100">
                            Assigner
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm scrollbar-thin">
        <table className="w-full min-w-[1100px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[220px]" />
            {days.map((_, i) => <col key={i} />)}
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
                      <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: emp.color }} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{emp.firstName} {emp.lastName}</div>
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
                    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
                    const onTimeOff = emp.timeOffs.some((to) => {
                      const ts = new Date(to.startDate); ts.setHours(0, 0, 0, 0);
                      const te = new Date(to.endDate); te.setHours(23, 59, 59, 999);
                      return dayStart <= te && dayEnd >= ts;
                    });
                    return (
                      <td key={di} className={`p-1 align-top ${onTimeOff ? "bg-neutral-100" : ""}`}>
                        {onTimeOff && dayShifts.length === 0 ? (
                          <button
                            onClick={() => openCreate(d, emp.id)}
                            className="w-full rounded bg-neutral-200 px-2 py-1 text-center text-[11px] text-neutral-600 hover:bg-neutral-300"
                          >
                            Congé
                          </button>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {dayShifts.map((s) => (
                              <ShiftPill
                                key={s.id}
                                shift={s}
                                position={positions.find((p) => p.id === s.positionId)}
                                onClick={() => openEdit(s)}
                              />
                            ))}
                            <button
                              onClick={() => openCreate(d, emp.id)}
                              className="rounded border border-dashed border-neutral-300 py-0.5 text-center text-[10px] text-neutral-400 hover:border-neutral-400 hover:bg-white hover:text-neutral-700"
                              title="Ajouter un shift"
                            >
                              +
                            </button>
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
                      {deficit > 0.5 ? `-${formatHours(deficit)}` : deficit < -0.5 ? `+${formatHours(-deficit)}` : "✓"}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ShiftEditor
        open={editor.mode !== "closed"}
        onClose={() => setEditor({ mode: "closed" })}
        onSaved={() => startTransition(() => router.refresh())}
        onDeleted={() => startTransition(() => router.refresh())}
        draft={editorDraft}
        scheduleId={schedule.id}
        employees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName }))}
        positions={positions}
        departments={departments}
      />

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

function ShiftPill({ shift, position, onClick }: { shift: Shift; position?: Position; onClick: () => void }) {
  const start = new Date(shift.start);
  const end = new Date(shift.end);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  const color = position?.color ?? "#64748b";
  return (
    <button
      onClick={onClick}
      className="group relative block w-full rounded border-l-4 bg-white px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm hover:shadow"
      style={{ borderLeftColor: color }}
      title={`${position?.name ?? "Shift"} · ${minutesToHHMM(startMin)}-${minutesToHHMM(endMin)}${shift.note ? " · " + shift.note : ""}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate font-medium text-neutral-800">
          {minutesToHHMM(startMin)}–{minutesToHHMM(endMin)}
        </span>
        {shift.locked && <span title="Verrouillé">🔒</span>}
      </div>
      <div className="truncate text-neutral-500">{position?.name ?? "—"}</div>
    </button>
  );
}
