-- AlterTable
ALTER TABLE "Course" ADD COLUMN "archivedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Course_archivedAt_updatedAt_idx" ON "Course"("archivedAt", "updatedAt");
