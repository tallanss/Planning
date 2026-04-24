"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { minutesToHHMM, hhmmToMinutes, DAY_LABELS_FR_SHORT } from "@/lib/utils";

type Template = {
  id: string;
  name: string;
  positionId: string | null;
  position: { id: string; name: string; color: string } | null;
  startMin: number;
  endMin: number;
  breakMin: number;
  headcount: number;
  daysOfWeek: string;
};
type Position = { id: string; name: string; color: string };

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function TemplatesView({
  templates,
  positions,
}: {
  templates: Template[];
  positions: Position[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    positionId: "",
    start: "09:00",
    end: "17:00",
    breakMin: 30,
    headcount: 1,
    days: new Set<number>([1, 2, 3, 4, 5]),
  });

  async function handleCreate() {
    if (!form.name) return;
    const res = await fetch("/api/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        positionId: form.positionId || null,
        startMin: hhmmToMinutes(form.start),
        endMin: hhmmToMinutes(form.end),
        breakMin: form.breakMin,
        headcount: form.headcount,
        daysOfWeek: Array.from(form.days).sort().join(","),
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", positionId: "", start: "09:00", end: "17:00", breakMin: 30, headcount: 1, days: new Set([1, 2, 3, 4, 5]) });
      startTransition(() => router.refresh());
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
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          {showForm ? "Annuler" : "+ Nouveau modèle"}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium">Nom</span>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium">Poste</span>
              <select className="input" value={form.positionId} onChange={(e) => setForm({ ...form, positionId: e.target.value })}>
                <option value="">—</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium">Début</span>
              <input className="input" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium">Fin</span>
              <input className="input" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium">Pause (min)</span>
              <input className="input" type="number" value={form.breakMin} onChange={(e) => setForm({ ...form, breakMin: Number(e.target.value) })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium">Effectif requis</span>
              <input className="input" type="number" min={1} value={form.headcount} onChange={(e) => setForm({ ...form, headcount: Number(e.target.value) })} />
            </label>
            <div className="col-span-2 md:col-span-2">
              <span className="mb-1 block text-xs font-medium">Jours applicables</span>
              <div className="flex gap-1">
                {DAY_ORDER.map((d) => {
                  const on = form.days.has(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        const next = new Set(form.days);
                        if (on) next.delete(d);
                        else next.add(d);
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
          <div className="mt-3 flex justify-end">
            <button onClick={handleCreate} className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white">
              Créer
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
                  <div className="text-sm text-neutral-500">{t.position?.name ?? "—"} · {t.headcount} personne(s)</div>
                </div>
                <button onClick={() => handleDelete(t.id)} className="text-xs text-neutral-400 hover:text-red-600">
                  Supprimer
                </button>
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
