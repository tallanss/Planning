"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { minutesToHHMM, hhmmToMinutes, DAY_LABELS_FR_SHORT } from "@/lib/utils";

type Template = {
  id: string;
  name: string;
  positionId: string | null;
  departmentId: string | null;
  siteId: string | null;
  position: { id: string; name: string; color: string } | null;
  department: { id: string; name: string } | null;
  startMin: number;
  endMin: number;
  breakMin: number;
  headcount: number;
  daysOfWeek: string;
};
type Position = { id: string; name: string; color: string };
type Department = { id: string; name: string; siteId: string | null; site?: { name: string } | null };

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

type FormState = {
  id?: string;
  name: string;
  positionId: string;
  departmentId: string;
  start: string;
  end: string;
  breakMin: number;
  headcount: number;
  days: Set<number>;
};

const defaultForm = (): FormState => ({
  name: "", positionId: "", departmentId: "", start: "09:00", end: "17:00",
  breakMin: 30, headcount: 1, days: new Set([1, 2, 3, 4, 5]),
});

export default function TemplatesView({
  templates,
  positions,
  departments,
}: {
  templates: Template[];
  positions: Position[];
  departments: Department[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setForm(defaultForm());
    setError(null);
  }
  function openEdit(t: Template) {
    setForm({
      id: t.id,
      name: t.name,
      positionId: t.positionId ?? "",
      departmentId: t.departmentId ?? "",
      start: minutesToHHMM(t.startMin),
      end: minutesToHHMM(t.endMin),
      breakMin: t.breakMin,
      headcount: t.headcount,
      days: new Set(t.daysOfWeek.split(",").map(Number).filter((n) => !Number.isNaN(n))),
    });
    setError(null);
  }

  async function handleSave() {
    if (!form) return;
    if (!form.name.trim()) { setError("Nom obligatoire"); return; }
    if (form.days.size === 0) { setError("Au moins un jour applicable"); return; }
    const startMin = hhmmToMinutes(form.start);
    const endMin = hhmmToMinutes(form.end);
    if (endMin <= startMin) { setError("L'heure de fin doit être après l'heure de début"); return; }

    setBusy(true);
    setError(null);
    try {
      const dept = departments.find((d) => d.id === form.departmentId);
      const payload = {
        name: form.name,
        positionId: form.positionId || null,
        departmentId: form.departmentId || null,
        siteId: dept?.siteId ?? null,
        startMin,
        endMin,
        breakMin: form.breakMin,
        headcount: form.headcount,
        daysOfWeek: Array.from(form.days).sort().join(","),
      };
      const res = form.id
        ? await fetch(`/api/template/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/template`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur");
        return;
      }
      setForm(null);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce modèle ?")) return;
    await fetch(`/api/template/${id}`, { method: "DELETE" });
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Modèles de shifts</h1>
          <p className="text-sm text-neutral-500">Les modèles définissent les besoins récurrents utilisés par le générateur</p>
        </div>
        <button
          onClick={form ? () => setForm(null) : openCreate}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          {form ? "Annuler" : "+ Nouveau modèle"}
        </button>
      </div>

      {form && (
        <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold">{form.id ? "Modifier le modèle" : "Nouveau modèle"}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Nom *"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Poste">
              <select className="input" value={form.positionId} onChange={(e) => setForm({ ...form, positionId: e.target.value })}>
                <option value="">—</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Département">
              <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.site?.name ? `${d.site.name} — ` : ""}{d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Début"><input className="input" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
            <Field label="Fin"><input className="input" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></Field>
            <Field label="Pause (min)"><input className="input" type="number" min={0} value={form.breakMin} onChange={(e) => setForm({ ...form, breakMin: Number(e.target.value) })} /></Field>
            <Field label="Effectif requis"><input className="input" type="number" min={1} value={form.headcount} onChange={(e) => setForm({ ...form, headcount: Number(e.target.value) })} /></Field>
            <div className="col-span-2">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Jours applicables</span>
              <div className="flex gap-1">
                {DAY_ORDER.map((d) => {
                  const on = form.days.has(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        const next = new Set(form.days);
                        if (on) next.delete(d); else next.add(d);
                        setForm({ ...form, days: next });
                      }}
                      className={`rounded-md px-2 py-1 text-xs ${on ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-700"}`}
                    >
                      {DAY_LABELS_FR_SHORT[d]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {error && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setForm(null)} disabled={busy} className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm">Annuler</button>
            <button onClick={handleSave} disabled={busy} className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {busy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {templates.map((t) => {
          const days = t.daysOfWeek.split(",").map(Number);
          return (
            <div key={t.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: t.position?.color ?? "#999" }} />
                    <div className="font-semibold">{t.name}</div>
                  </div>
                  <div className="text-sm text-neutral-600">
                    {minutesToHHMM(t.startMin)} – {minutesToHHMM(t.endMin)} · pause {t.breakMin}min
                  </div>
                  <div className="text-sm text-neutral-500">
                    {t.position?.name ?? "—"}
                    {t.department ? ` · ${t.department.name}` : ""}
                    {" · "}
                    {t.headcount} personne(s)
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => openEdit(t)} className="text-neutral-600 hover:text-neutral-900">Modifier</button>
                  <button onClick={() => handleDelete(t.id)} className="text-neutral-400 hover:text-red-600">Supprimer</button>
                </div>
              </div>
              <div className="mt-2 flex gap-1">
                {DAY_ORDER.map((d) => (
                  <span key={d} className={`rounded px-1.5 py-0.5 text-[10px] ${days.includes(d) ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-400"}`}>
                    {DAY_LABELS_FR_SHORT[d]}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <style>{`.input{width:100%;border:1px solid #e5e5e5;border-radius:6px;padding:6px 10px;font-size:14px;background:#fff}`}</style>
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
