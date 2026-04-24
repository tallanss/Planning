-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "country" TEXT NOT NULL DEFAULT 'FR',
    "weekStart" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    CONSTRAINT "Site_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "siteId" TEXT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Department_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0ea5e9',
    "hourlyRate" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Position_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Skill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PositionSkill" (
    "positionId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    PRIMARY KEY ("positionId", "skillId"),
    CONSTRAINT "PositionSkill_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PositionSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "departmentId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "contractType" TEXT NOT NULL DEFAULT 'CDI',
    "weeklyHours" REAL NOT NULL DEFAULT 35,
    "hourlyRate" REAL NOT NULL DEFAULT 0,
    "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" DATETIME,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmployeeSkill" (
    "employeeId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY ("employeeId", "skillId"),
    CONSTRAINT "EmployeeSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EmployeeSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Availability_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeOff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CONGE',
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "note" TEXT,
    CONSTRAINT "TimeOff_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShiftTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "positionId" TEXT,
    "name" TEXT NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "breakMin" INTEGER NOT NULL DEFAULT 0,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "daysOfWeek" TEXT NOT NULL DEFAULT '1,2,3,4,5',
    CONSTRAINT "ShiftTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftTemplate_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    CONSTRAINT "Schedule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "employeeId" TEXT,
    "positionId" TEXT,
    "departmentId" TEXT,
    "siteId" TEXT,
    "start" DATETIME NOT NULL,
    "end" DATETIME NOT NULL,
    "breakMin" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Shift_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Shift_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Shift_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Shift_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Shift_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LaborRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "minDailyRestH" REAL NOT NULL DEFAULT 11,
    "minWeeklyRestH" REAL NOT NULL DEFAULT 35,
    "maxDailyH" REAL NOT NULL DEFAULT 10,
    "maxWeeklyH" REAL NOT NULL DEFAULT 48,
    "maxAvgWeeklyH" REAL NOT NULL DEFAULT 44,
    "breakAfterH" REAL NOT NULL DEFAULT 6,
    "breakMin" INTEGER NOT NULL DEFAULT 20,
    "maxAmplitudeH" REAL NOT NULL DEFAULT 13,
    "maxConsecDays" INTEGER NOT NULL DEFAULT 6,
    CONSTRAINT "LaborRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Site_companyId_idx" ON "Site"("companyId");

-- CreateIndex
CREATE INDEX "Department_companyId_idx" ON "Department"("companyId");

-- CreateIndex
CREATE INDEX "Position_companyId_idx" ON "Position"("companyId");

-- CreateIndex
CREATE INDEX "Skill_companyId_idx" ON "Skill"("companyId");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Availability_employeeId_idx" ON "Availability"("employeeId");

-- CreateIndex
CREATE INDEX "TimeOff_employeeId_idx" ON "TimeOff"("employeeId");

-- CreateIndex
CREATE INDEX "ShiftTemplate_companyId_idx" ON "ShiftTemplate"("companyId");

-- CreateIndex
CREATE INDEX "Schedule_companyId_idx" ON "Schedule"("companyId");

-- CreateIndex
CREATE INDEX "Shift_scheduleId_idx" ON "Shift"("scheduleId");

-- CreateIndex
CREATE INDEX "Shift_employeeId_idx" ON "Shift"("employeeId");

-- CreateIndex
CREATE INDEX "Shift_start_idx" ON "Shift"("start");

-- CreateIndex
CREATE UNIQUE INDEX "LaborRule_companyId_key" ON "LaborRule"("companyId");
