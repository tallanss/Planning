// Seed de démonstration : entreprise "Le Grand Bistrot" — 2 sites,
// 80 employés, 5 postes, compétences, disponibilités, quelques congés.

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

const FIRST_NAMES = [
  "Alice","Baptiste","Camille","Damien","Elise","Farah","Gabriel","Hugo","Ines",
  "Jules","Kenza","Louis","Manon","Nour","Oscar","Paul","Quentin","Rania","Sacha",
  "Tom","Ugo","Valentine","Wassim","Yasmine","Zacharie","Agathe","Bastien","Chloe",
  "Diego","Emma","Fanny","Gaspard","Helene","Ilyas","Juliette","Karim","Lea",
  "Maxime","Noah","Olivia","Pierre","Romane","Samuel","Theo","Ulysse","Victoire",
  "Wael","Xavier","Yanis","Zoe","Arthur","Bianca","Cyril","Daphne","Ethan","Fiona",
  "Gregoire","Hana","Isaac","Jade","Kilian","Lou","Milo","Nina","Owen","Pauline",
  "Raphael","Sarah","Tristan","Uma","Vince","Walid","Xena","Yann","Zita","Adrien",
  "Bella","Clara","Dany"
];

const LAST_NAMES = [
  "Martin","Bernard","Dubois","Thomas","Robert","Richard","Petit","Durand",
  "Leroy","Moreau","Simon","Laurent","Lefebvre","Michel","Garcia","David",
  "Bertrand","Roux","Vincent","Fournier","Morel","Girard","Andre","Lefevre",
  "Mercier","Dupont","Lambert","Bonnet","Francois","Martinez","Legrand","Garnier"
];

const COLORS = [
  "#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#14b8a6",
  "#f97316","#6366f1","#84cc16","#06b6d4","#d946ef"
];

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

async function main() {
  console.log("Nettoyage...");
  await prisma.shift.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.shiftTemplate.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.employeeSkill.deleteMany();
  await prisma.positionSkill.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.position.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.department.deleteMany();
  await prisma.site.deleteMany();
  await prisma.laborRule.deleteMany();
  await prisma.company.deleteMany();

  console.log("Création entreprise...");
  const company = await prisma.company.create({
    data: {
      name: "Le Grand Bistrot",
      timezone: "Europe/Paris",
      country: "FR",
      rules: {
        create: {
          minDailyRestH: 11,
          minWeeklyRestH: 35,
          maxDailyH: 10,
          maxWeeklyH: 48,
          maxAvgWeeklyH: 44,
          breakAfterH: 6,
          breakMin: 30,
          maxAmplitudeH: 13,
          maxConsecDays: 6,
        },
      },
    },
  });

  console.log("Sites et départements...");
  const siteCentre = await prisma.site.create({
    data: { companyId: company.id, name: "Paris Centre", address: "12 rue de Rivoli, Paris" },
  });
  const siteGare = await prisma.site.create({
    data: { companyId: company.id, name: "Paris Gare du Nord", address: "18 rue de Dunkerque, Paris" },
  });

  const deptSalle = await prisma.department.create({
    data: { companyId: company.id, siteId: siteCentre.id, name: "Salle", color: "#0ea5e9" },
  });
  const deptCuisine = await prisma.department.create({
    data: { companyId: company.id, siteId: siteCentre.id, name: "Cuisine", color: "#f59e0b" },
  });
  const deptBar = await prisma.department.create({
    data: { companyId: company.id, siteId: siteCentre.id, name: "Bar", color: "#8b5cf6" },
  });
  const deptSalleGare = await prisma.department.create({
    data: { companyId: company.id, siteId: siteGare.id, name: "Salle Gare", color: "#10b981" },
  });
  const deptCuisineGare = await prisma.department.create({
    data: { companyId: company.id, siteId: siteGare.id, name: "Cuisine Gare", color: "#ef4444" },
  });
  const departments = [deptSalle, deptCuisine, deptBar, deptSalleGare, deptCuisineGare];

  console.log("Compétences...");
  const skillNames = ["HACCP", "Caisse", "Bar", "Sommellerie", "Cuisine chaud", "Cuisine froid", "Pâtisserie", "Accueil"];
  const skills = await Promise.all(
    skillNames.map((name) => prisma.skill.create({ data: { companyId: company.id, name } })),
  );

  console.log("Postes...");
  const posServeur = await prisma.position.create({
    data: {
      companyId: company.id,
      name: "Serveur",
      color: "#0ea5e9",
      hourlyRate: 13,
      requiredSkills: { create: [{ skillId: skills.find((s) => s.name === "Accueil")!.id }] },
    },
  });
  const posCaissier = await prisma.position.create({
    data: {
      companyId: company.id,
      name: "Caissier",
      color: "#10b981",
      hourlyRate: 13,
      requiredSkills: { create: [{ skillId: skills.find((s) => s.name === "Caisse")!.id }] },
    },
  });
  const posCuisinier = await prisma.position.create({
    data: {
      companyId: company.id,
      name: "Cuisinier",
      color: "#f59e0b",
      hourlyRate: 16,
      requiredSkills: {
        create: [
          { skillId: skills.find((s) => s.name === "HACCP")!.id },
          { skillId: skills.find((s) => s.name === "Cuisine chaud")!.id },
        ],
      },
    },
  });
  const posBarman = await prisma.position.create({
    data: {
      companyId: company.id,
      name: "Barman",
      color: "#8b5cf6",
      hourlyRate: 14,
      requiredSkills: { create: [{ skillId: skills.find((s) => s.name === "Bar")!.id }] },
    },
  });
  const posPlongeur = await prisma.position.create({
    data: {
      companyId: company.id,
      name: "Plongeur",
      color: "#64748b",
      hourlyRate: 12,
    },
  });

  console.log("Employés...");
  const TOTAL = 80;
  for (let i = 0; i < TOTAL; i++) {
    const firstName = pick(FIRST_NAMES, i);
    const lastName = pick(LAST_NAMES, i * 3 + 7);
    const dept = pick(departments, i);
    const color = pick(COLORS, i);

    // Répartition : 25 serveurs, 15 cuisiniers, 10 caissiers, 10 barmans, 10 plongeurs, et autres
    let empSkills: string[] = [];
    if (dept.name.startsWith("Salle")) {
      empSkills = ["Accueil"];
      if (i % 3 === 0) empSkills.push("Caisse");
    } else if (dept.name.startsWith("Cuisine")) {
      empSkills = ["HACCP", i % 2 === 0 ? "Cuisine chaud" : "Cuisine froid"];
      if (i % 5 === 0) empSkills.push("Pâtisserie");
    } else if (dept.name === "Bar") {
      empSkills = ["Bar"];
      if (i % 4 === 0) empSkills.push("Sommellerie");
    }

    const weeklyHours = i % 4 === 0 ? 24 : i % 7 === 0 ? 20 : 35;
    const contractType = i % 10 === 0 ? "CDD" : "CDI";

    await prisma.employee.create({
      data: {
        companyId: company.id,
        departmentId: dept.id,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@bistrot.fr`,
        color,
        contractType,
        weeklyHours,
        hourlyRate: 13 + (i % 5),
        skills: {
          create: empSkills.map((name) => ({
            skill: { connect: { id: skills.find((s) => s.name === name)!.id } },
            level: 3 + (i % 3),
          })),
        },
        availabilities: {
          create: [0, 1, 2, 3, 4, 5, 6].flatMap((dow) => {
            // ~1 jour off par semaine
            if (dow === i % 7) return [];
            return [{ dayOfWeek: dow, startMin: 8 * 60, endMin: 23 * 60, available: true }];
          }),
        },
      },
    });
  }

  console.log("Templates de shifts...");
  // Service midi / soir, à décliner sur les départements
  const templates = [
    { name: "Service midi — Salle", start: 11 * 60, end: 15 * 60, headcount: 6, position: posServeur, department: deptSalle },
    { name: "Service soir — Salle", start: 18 * 60, end: 23 * 60, headcount: 7, position: posServeur, department: deptSalle },
    { name: "Service midi — Cuisine", start: 10 * 60, end: 15 * 60, headcount: 4, position: posCuisinier, department: deptCuisine },
    { name: "Service soir — Cuisine", start: 17 * 60, end: 23 * 60, headcount: 5, position: posCuisinier, department: deptCuisine },
    { name: "Plonge midi", start: 11 * 60 + 30, end: 15 * 60, headcount: 2, position: posPlongeur, department: deptCuisine },
    { name: "Plonge soir", start: 18 * 60, end: 23 * 60 + 30, headcount: 2, position: posPlongeur, department: deptCuisine },
    { name: "Bar journée", start: 12 * 60, end: 20 * 60, headcount: 2, position: posBarman, department: deptBar },
    { name: "Bar soir", start: 18 * 60, end: 23 * 60 + 30, headcount: 2, position: posBarman, department: deptBar },
    { name: "Caisse journée", start: 11 * 60, end: 19 * 60, headcount: 2, position: posCaissier, department: deptSalle },
    { name: "Service midi Gare", start: 11 * 60, end: 15 * 60, headcount: 4, position: posServeur, department: deptSalleGare },
    { name: "Service soir Gare", start: 18 * 60, end: 23 * 60, headcount: 4, position: posServeur, department: deptSalleGare },
    { name: "Cuisine midi Gare", start: 10 * 60, end: 15 * 60, headcount: 3, position: posCuisinier, department: deptCuisineGare },
    { name: "Cuisine soir Gare", start: 17 * 60, end: 23 * 60, headcount: 3, position: posCuisinier, department: deptCuisineGare },
  ];

  for (const t of templates) {
    await prisma.shiftTemplate.create({
      data: {
        companyId: company.id,
        positionId: t.position.id,
        name: t.name,
        startMin: t.start,
        endMin: t.end,
        breakMin: t.end - t.start > 6 * 60 ? 30 : 0,
        headcount: t.headcount,
        daysOfWeek: "1,2,3,4,5,6,0",
      },
    });
  }

  console.log("Congés d'exemple...");
  const someEmployees = await prisma.employee.findMany({ take: 6 });
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  for (let i = 0; i < someEmployees.length; i++) {
    const start = new Date(now);
    start.setDate(start.getDate() + i * 2);
    const end = new Date(start);
    end.setDate(end.getDate() + 2);
    await prisma.timeOff.create({
      data: {
        employeeId: someEmployees[i].id,
        startDate: start,
        endDate: end,
        kind: i % 2 === 0 ? "CONGE" : "MALADIE",
        status: "APPROVED",
      },
    });
  }

  console.log("Planning vide initial...");
  const monday = new Date(now);
  const day = monday.getDay();
  const diff = (day + 6) % 7;
  monday.setDate(monday.getDate() - diff);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  await prisma.schedule.create({
    data: {
      companyId: company.id,
      name: `Semaine du ${monday.toLocaleDateString("fr-FR")}`,
      startDate: monday,
      endDate: sunday,
      status: "DRAFT",
    },
  });

  console.log("✓ Seed terminé.");
  console.log(`  - Entreprise : ${company.name}`);
  console.log(`  - 2 sites, 5 départements`);
  console.log(`  - ${TOTAL} employés`);
  console.log(`  - ${templates.length} templates de shifts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
