"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  contractType: string;
  weeklyHours: number;
  hourlyRate: number;
  active: boolean;
  color: string;
  departmentId: string | null;
  department: { id: string; name: string } | null;
  skills: { skill: { id: string; name: string }; level: number }[];
};

export default function EmployeesView({
  employees,
  departments,
  skills,
}: {
  employees: Employee[];
  departments: { id: string; name: string }[];
  skills: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contractType: "CDI",
    weeklyHours: 35,
    hourlyRate: 13,
    departmentId: "",
    skillIds: [] as string[],
  });

  const filtered = employees.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.firstName.toLowerCase().includes(q) ||
      e.lastName.toLowerCase().includes(q) ||
      e.department?.name.toLowerCase().includes(q)
    );
  });

  async function handleCreate() {
    if (!form.firstName || !form.lastName) return;
    const res = await fetch("/api/employee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        departmentId: form.departmentId || null,
        email: form.email || null,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ firstName: "", lastName: "", email: "", contractType: "CDI", weeklyHours: 35, hourlyRate: 13, departmentId: "", skillIds: [] });
      startTransition(() => router.refresh());
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/employee/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Employés</h1>
          <p className="text-sm text-neutral-500">{employees.length} total · {employees.filter((e) => e.active).length} actifs</p>
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
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            {showForm ? "Annuler" : "+ Nouvel employé"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Prénom">
              <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </Field>
            <Field label="Nom">
              <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Département">
              <select className="input" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Contrat">
              <select className="input" value={form.contractType} onChange={(e) => setForm({ ...form, contractType: e.target.value })}>
                <option>CDI</option><option>CDD</option><option>INTERIM</option><option>STAGE</option><option>ALTERNANCE</option>
              </select>
            </Field>
            <Field label="Heures / sem">
              <input className="input" type="number" value={form.weeklyHours} onChange={(e) => setForm({ ...form, weeklyHours: Number(e.target.value) })} />
            </Field>
            <Field label="Taux horaire (€)">
              <input className="input" type="number" step="0.5" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })} />
            </Field>
            <Field label="Compétences">
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
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={handleCreate} className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white">
              Créer
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
              <th className="px-3 py-2">Compétences</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-neutral-100">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
                    <span className="font-medium">{e.firstName} {e.lastName}</span>
                  </div>
                  <div className="text-xs text-neutral-500">{e.email ?? ""}</div>
                </td>
                <td className="px-3 py-2">{e.department?.name ?? "—"}</td>
                <td className="px-3 py-2">{e.contractType}</td>
                <td className="px-3 py-2">{e.weeklyHours}h · {e.hourlyRate}€/h</td>
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
                  <button onClick={() => toggleActive(e.id, e.active)} className="text-xs text-neutral-500 hover:text-neutral-900">
                    {e.active ? "Désactiver" : "Réactiver"}
                  </button>
                </td>
              </tr>
            ))}
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
