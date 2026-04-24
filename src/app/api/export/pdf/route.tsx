import { NextRequest } from "next/server";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { addDays, DAY_LABELS_FR_SHORT, minutesToHHMM } from "@/lib/utils";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica" },
  header: { marginBottom: 12, borderBottom: "1 solid #111", paddingBottom: 6 },
  h1: { fontSize: 16, fontWeight: "bold" },
  sub: { fontSize: 9, color: "#555", marginTop: 2 },
  table: { display: "flex", flexDirection: "column", borderTop: "0.5 solid #ccc" },
  row: { flexDirection: "row", borderBottom: "0.5 solid #eee", minHeight: 22 },
  rowHead: { flexDirection: "row", borderBottom: "1 solid #111", backgroundColor: "#f5f5f5" },
  cellName: { width: 110, padding: 4, borderRight: "0.5 solid #eee" },
  cellDay: { flex: 1, padding: 4, borderRight: "0.5 solid #eee" },
  cellTotal: { width: 45, padding: 4, textAlign: "right" },
  shiftLine: { fontSize: 8 },
  bold: { fontWeight: "bold" },
  hdrText: { fontSize: 9, fontWeight: "bold" },
});

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
    include: { employee: true, position: true },
    orderBy: { start: "asc" },
  });
  const employees = await prisma.employee.findMany({
    where: { companyId: schedule.companyId, active: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const start = new Date(schedule.startDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const doc = (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.h1}>{schedule.company.name} — Planning</Text>
          <Text style={styles.sub}>
            Semaine du {start.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            {"  ·  "}
            {schedule.status === "PUBLISHED" ? "Publié" : "Brouillon"}
            {"  ·  "}
            Généré le {new Date().toLocaleDateString("fr-FR")}
          </Text>
        </View>
        <View style={styles.table}>
          <View style={styles.rowHead}>
            <View style={styles.cellName}><Text style={styles.hdrText}>Employé</Text></View>
            {days.map((d, i) => (
              <View key={i} style={styles.cellDay}>
                <Text style={styles.hdrText}>{DAY_LABELS_FR_SHORT[d.getDay()]} {d.getDate()}/{d.getMonth() + 1}</Text>
              </View>
            ))}
            <View style={styles.cellTotal}><Text style={styles.hdrText}>Heures</Text></View>
          </View>
          {employees.map((emp) => {
            const empShifts = shifts.filter((s) => s.employeeId === emp.id);
            const total = empShifts.reduce(
              (a, s) => a + (new Date(s.end).getTime() - new Date(s.start).getTime()) / 3_600_000 - s.breakMin / 60,
              0,
            );
            return (
              <View key={emp.id} style={styles.row} wrap={false}>
                <View style={styles.cellName}>
                  <Text style={styles.bold}>{emp.lastName}</Text>
                  <Text>{emp.firstName}</Text>
                  <Text style={{ color: "#777", fontSize: 7 }}>{emp.contractType} · {emp.weeklyHours}h</Text>
                </View>
                {days.map((d, i) => {
                  const dayShifts = empShifts.filter((s) => {
                    const sd = new Date(s.start);
                    return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth() && sd.getDate() === d.getDate();
                  });
                  return (
                    <View key={i} style={styles.cellDay}>
                      {dayShifts.map((s) => {
                        const st = new Date(s.start);
                        const et = new Date(s.end);
                        return (
                          <Text key={s.id} style={styles.shiftLine}>
                            {minutesToHHMM(st.getHours() * 60 + st.getMinutes())}–{minutesToHHMM(et.getHours() * 60 + et.getMinutes())}
                            {s.position ? `  ${s.position.name}` : ""}
                          </Text>
                        );
                      })}
                    </View>
                  );
                })}
                <View style={styles.cellTotal}>
                  <Text style={styles.bold}>{total.toFixed(1)}h</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  const filename = `planning_${schedule.startDate.toISOString().slice(0, 10)}.pdf`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
