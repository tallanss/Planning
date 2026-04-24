import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { addDays, DAY_LABELS_FR_SHORT, minutesToHHMM } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scheduleId = searchParams.get("scheduleId");
  if (!scheduleId) return new Response("Missing scheduleId", { status: 400 });

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: { company: true },
  });
  if (!schedule) return new Response("Not found", { status: 404 });

  const shifts = await prisma.shift.findMany({
    where: { scheduleId },
    orderBy: { start: "asc" },
    include: { employee: true, position: true },
  });
  const employees = await prisma.employee.findMany({
    where: { companyId: schedule.companyId, active: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Planify";
  wb.created = new Date();

  // Feuille 1 : Planning hebdomadaire (tableau employé × jour)
  const sheet = wb.addWorksheet("Planning", {
    pageSetup: { orientation: "landscape", fitToPage: true },
  });

  const start = new Date(schedule.startDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  sheet.columns = [
    { header: "Employé", key: "emp", width: 28 },
    { header: "Contrat", key: "contract", width: 10 },
    ...days.map((d) => ({
      header: `${DAY_LABELS_FR_SHORT[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`,
      key: `d${d.getDate()}`,
      width: 22,
    })),
    { header: "Total h", key: "total", width: 10 },
  ];

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };

  for (const emp of employees) {
    const row: Record<string, string | number> = {
      emp: `${emp.lastName} ${emp.firstName}`,
      contract: `${emp.contractType} ${emp.weeklyHours}h`,
    };
    let total = 0;
    for (const d of days) {
      const key = `d${d.getDate()}`;
      const dayShifts = shifts
        .filter((s) => s.employeeId === emp.id)
        .filter((s) => {
          const sd = new Date(s.start);
          return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth() && sd.getDate() === d.getDate();
        });
      if (dayShifts.length === 0) {
        row[key] = "";
      } else {
        row[key] = dayShifts
          .map((s) => {
            const st = new Date(s.start);
            const et = new Date(s.end);
            const h = (et.getTime() - st.getTime()) / 3_600_000 - s.breakMin / 60;
            total += h;
            return `${minutesToHHMM(st.getHours() * 60 + st.getMinutes())}-${minutesToHHMM(
              et.getHours() * 60 + et.getMinutes(),
            )}${s.position ? ` ${s.position.name}` : ""}`;
          })
          .join("\n");
      }
    }
    row.total = Number(total.toFixed(2));
    sheet.addRow(row);
  }

  // Style
  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    row.alignment = { vertical: "top", wrapText: true };
  });

  // Feuille 2 : Récap heures par employé
  const recap = wb.addWorksheet("Récap heures");
  recap.columns = [
    { header: "Employé", key: "emp", width: 28 },
    { header: "Département", key: "dept", width: 18 },
    { header: "Contrat", key: "contract", width: 10 },
    { header: "Heures contrat", key: "contractH", width: 15 },
    { header: "Heures planifiées", key: "plannedH", width: 17 },
    { header: "Écart", key: "diff", width: 10 },
    { header: "Coût estimé", key: "cost", width: 15 },
  ];
  recap.getRow(1).font = { bold: true };
  const deptMap = new Map(
    (await prisma.department.findMany({ where: { companyId: schedule.companyId } })).map((d) => [d.id, d.name]),
  );
  for (const emp of employees) {
    const empShifts = shifts.filter((s) => s.employeeId === emp.id);
    const totalH = empShifts.reduce(
      (a, s) => a + (new Date(s.end).getTime() - new Date(s.start).getTime()) / 3_600_000 - s.breakMin / 60,
      0,
    );
    recap.addRow({
      emp: `${emp.lastName} ${emp.firstName}`,
      dept: emp.departmentId ? deptMap.get(emp.departmentId) ?? "—" : "—",
      contract: emp.contractType,
      contractH: emp.weeklyHours,
      plannedH: Number(totalH.toFixed(2)),
      diff: Number((totalH - emp.weeklyHours).toFixed(2)),
      cost: Number((totalH * emp.hourlyRate).toFixed(2)),
    });
  }

  // Feuille 3 : Détail shifts
  const detail = wb.addWorksheet("Shifts détaillés");
  detail.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Début", key: "start", width: 8 },
    { header: "Fin", key: "end", width: 8 },
    { header: "Pause (min)", key: "br", width: 12 },
    { header: "Heures", key: "h", width: 10 },
    { header: "Employé", key: "emp", width: 24 },
    { header: "Poste", key: "pos", width: 18 },
  ];
  detail.getRow(1).font = { bold: true };
  for (const s of shifts) {
    const st = new Date(s.start);
    const et = new Date(s.end);
    const h = (et.getTime() - st.getTime()) / 3_600_000 - s.breakMin / 60;
    detail.addRow({
      date: st.toLocaleDateString("fr-FR"),
      start: minutesToHHMM(st.getHours() * 60 + st.getMinutes()),
      end: minutesToHHMM(et.getHours() * 60 + et.getMinutes()),
      br: s.breakMin,
      h: Number(h.toFixed(2)),
      emp: s.employee ? `${s.employee.lastName} ${s.employee.firstName}` : "— non pourvu",
      pos: s.position?.name ?? "—",
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `planning_${schedule.startDate.toISOString().slice(0, 10)}.xlsx`;
  return new Response(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
