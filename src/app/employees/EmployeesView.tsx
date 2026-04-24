"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Skill = { id: string; name: string };
type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  contractType: string;
  weeklyHours: number;
  hourlyRate: number;
  active: boolean;
  color: string;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  skills: { skill: Skill; level: number }[];
};

export default function EmployeesView({
  employees,
  departments,
  skills,
}: {
  employees: Employee[];
  departments: { id: string; name: string }[];
  skills: Skill[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    contractType: "CDI", weeklyHours: 35, hourlyRate: 13, departmentId: "", skillIds: [] as string[],
  });

  const filtered = employees.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      (e.department?.name.toLowerCase().includes(q) ?? false)
    );
  });

  function resetForm() {
    setForm({ firstName: "", lastName: "", email: "", phone: "", contractType: "CDI", weeklyHours: 35, hourlyRate: 13, departmentId: "", skillIds: [] });
    setError(null);
  }

  async function handleCreate() {
    if (!form.firstName || !form.lastName) {
      setError("Prénom et nom obligatoires");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email || null,
          phone: form.phone || null,
          departmentId: form.departmentId || null,
          contractType: form.contractType,
          weeklyHours: form.weeklyHours,
          hourlyRate: form.hourlyRate,
          skillIds: form.skillIds,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erreur création");
        return;
      }
      setShowForm(false);
      resetForm();
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/employee/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employés</h1>
          <p className="text-sm text-neutral-500">
            {employees.length} total · {employees.filter((e) => e.active).length} actifs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm"
          />
          <button
            onClick={() => { setShowForm((v) => !v); resetForm(); }}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            {showForm ? "Annuler" : "+ Nouvel employé"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Prénom *"><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
            <Field label="Nom *"><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
            <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Téléphone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Département">
              <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Contrat">
              <select className="input" value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
                <option>CDI</option><option>CDD</option><option>INTERIM</option><option>STAGE</option><option>ALTERNANCE</option>
              </select>
            </Field>
            <Field label="Heures / sem"><input className="input" type="number" min={1} max={60} value={form.weeklyHours} onChange={(e) => setForm({ ...form, weeklyHours: Number(e.target.value) })} /></Field>
            <Field label="Taux horaire (€)"><input className="input" type="number" step="0.5" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })} /></Field>
            <div className="col-span-2 md:col-span-4">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Compétences</span>
              <div className="flex flex-wrap gap-1">
                {skills.map((sk) => {
                  const on = form.skillIds.includes(sk.id);
                  return (
                    <button
                      key={sk.id}
                      type="button"
                      onClick={() => setForm({ ...form, skillIds: on ? form.skillIds.filter((x) => x !== sk.id) : [...form.skillIds, sk.id] })}
                      className={`rounded-full px-2 py-0.5 text-xs ${on ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-700"}`}
                    >
                      {sk.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {error && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="mt-3 flex justify-end">
            <button onClick={handleCreate} disabled={busy} className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              {busy ? "Création…" : "Créer"}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-3 py-2">Nom</th>
              <th className="px-3 py-2">Département</th>
              <th className="px-3 py-2">Contrat</th>
              <th className="px-3 py-2">Heures</th>
              <th className="px-3 py-2">€/h</th>
              <th className="px-3 py-2">Compétences</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => {
              const editing = editingId === e.id;
              return (
                <tr key={e.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
                      <span className="font-medium">{e.firstName} {e.lastName}</span>
                    </div>
                    <div className="text-xs text-neutral-500">{e.email ?? ""}</div>
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <select
                        defaultValue={e.departmentId ?? ""}
                        onBlur={(ev) => patch(e.id, { departmentId: ev.target.value || null })}
                        className="rounded border border-neutral-200 px-2 py-0.5 text-sm"
                      >
                        <option value="">—</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    ) : (e.department?.name ?? "—")}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <select
                        defaultValue={e.contractType}
                        onBlur={(ev) => patch(e.id, { contractType: ev.target.value })}
                        className="rounded border border-neutral-200 px-2 py-0.5 text-sm"
                      >
                        <option>CDI</option><option>CDD</option><option>INTERIM</option><option>STAGE</option><option>ALTERNANCE</option>
                      </select>
                    ) : e.contractType}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <input
                        defaultValue={e.weeklyHours}
                        type="number"
                        min={1}
                        max={60}
                        onBlur={(ev) => patch(e.id, { weeklyHours: Number(ev.target.value) })}
                        className="w-16 rounded border border-neutral-200 px-2 py-0.5 text-sm"
                      />
                    ) : `${e.weeklyHours}h`}
                  </td>
                  <td className="px-3 py-2">
                    {editing ? (
                      <input
                        defaultValue={e.hourlyRate}
                        type="number"
                        step="0.5"
                        onBlur={(ev) => patch(e.id, { hourlyRate: Number(ev.target.value) })}
                        className="w-20 rounded border border-neutral-200 px-2 py-0.5 text-sm"
                      />
                    ) : `${e.hourlyRate}€`}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {e.skills.map((s) => (
                        <span key={s.skill.id} className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px]">{s.skill.name}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {e.active ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-700">Actif</span>
                    ) : (
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">Inactif</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2 text-xs">
                      <button
                        onClick={() => setEditingId(editing ? null : e.id)}
                        className="text-neutral-600 hover:text-neutral-900"
                      >
                        {editing ? "OK" : "Modifier"}
                      </button>
                      <button
                        onClick={() => patch(e.id, { active: !e.active })}
                        className="text-neutral-500 hover:text-neutral-900"
                      >
                        {e.active ? "Désactiver" : "Réactiver"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
