"use client";

import { useEffect, useState } from "react";
import { minutesToHHMM, hhmmToMinutes } from "@/lib/utils";

type Position = { id: string; name: string; color: string };
type Employee = { id: string; firstName: string; lastName: string };
type Department = { id: string; name: string };

type ShiftDraft = {
  id?: string;
  start: Date;
  end: Date;
  breakMin: number;
  employeeId: string | null;
  positionId: string | null;
  departmentId: string | null;
  note?: string | null;
  locked?: boolean;
};

export default function ShiftEditor({
  open,
  onClose,
  onSaved,
  onDeleted,
  draft,
  scheduleId,
  employees,
  positions,
  departments,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
  draft: ShiftDraft | null;
  scheduleId: string;
  employees: Employee[];
  positions: Position[];
  departments: Department[];
}) {
  const [form, setForm] = useState<ShiftDraft | null>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(draft);
    setError(null);
  }, [draft]);

  if (!open || !form) return null;

  const start = form.start;
  const startHHMM = minutesToHHMM(start.getHours() * 60 + start.getMinutes());
  const endHHMM = minutesToHHMM(form.end.getHours() * 60 + form.end.getMinutes());
  const dateStr = start.toISOString().slice(0, 10);

  function setStartTime(hhmm: string) {
    if (!form) return;
    const mins = hhmmToMinutes(hhmm);
    const d = new Date(form.start);
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    setForm({ ...form, start: d });
  }
  function setEndTime(hhmm: string) {
    if (!form) return;
    const mins = hhmmToMinutes(hhmm);
    const d = new Date(form.end);
    d.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
    setForm({ ...form, end: d });
  }
  function setDate(d: string) {
    if (!form) return;
    const [y, m, day] = d.split("-").map(Number);
    const s = new Date(form.start);
    s.setFullYear(y, m - 1, day);
    const e = new Date(form.end);
    e.setFullYear(y, m - 1, day);
    setForm({ ...form, start: s, end: e });
  }

  async function handleSave() {
    if (!form) return;
    setError(null);
    if (form.end.getTime() <= form.start.getTime()) {
      setError("L'heure de fin doit être après l'heure de début");
      return;
    }
    setSaving(true);
    try {
      const body = {
        scheduleId,
        employeeId: form.employeeId,
        positionId: form.positionId,
        departmentId: form.departmentId,
        start: form.start.toISOString(),
        end: form.end.toISOString(),
        breakMin: form.breakMin,
        note: form.note ?? null,
      };
      const res = form.id
        ? await fetch(`/api/shift/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, locked: form.locked ?? false }),
          })
        : await fetch(`/api/shift`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur lors de l'enregistrement");
        return;
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form?.id) return;
    if (!confirm("Supprimer ce shift ?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/shift/${form.id}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted?.();
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {form.id ? "Modifier le shift" : "Nouveau shift"}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900">✕</button>
        </div>

        <div className="space-y-3">
          <Field label="Employé">
            <select
              className="input"
              value={form.employeeId ?? ""}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value || null })}
            >
              <option value="">— Non assigné —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.lastName} {emp.firstName}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-3 gap-2">
            <Field label="Date">
              <input className="input" type="date" value={dateStr} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Début">
              <input className="input" type="time" value={startHHMM} onChange={(e) => setStartTime(e.target.value)} />
            </Field>
            <Field label="Fin">
              <input className="input" type="time" value={endHHMM} onChange={(e) => setEndTime(e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Poste">
              <select
                className="input"
                value={form.positionId ?? ""}
                onChange={(e) => setForm({ ...form, positionId: e.target.value || null })}
              >
                <option value="">—</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Département">
              <select
                className="input"
                value={form.departmentId ?? ""}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value || null })}
              >
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Pause (min)">
              <input
                className="input"
                type="number"
                min={0}
                value={form.breakMin}
                onChange={(e) => setForm({ ...form, breakMin: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Verrouillé (protégé de la génération)">
              <label className="flex h-[34px] items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.locked ?? false}
                  onChange={(e) => setForm({ ...form, locked: e.target.checked })}
                />
                {form.locked ? "Oui" : "Non"}
              </label>
            </Field>
          </div>

          <Field label="Note (optionnel)">
            <input
              className="input"
              value={form.note ?? ""}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="ex. remplacement Paul"
            />
          </Field>

          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>

        <div className="mt-4 flex items-center justify-between">
          {form.id ? (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Supprimer
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm">
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>

        <style>{`.input{width:100%;border:1px solid #e5e5e5;border-radius:6px;padding:6px 10px;font-size:14px;background:#fff}`}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-neutral-600">{label}</span>
      {children}
    </label>
  );
}
