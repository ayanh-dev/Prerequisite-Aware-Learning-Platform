-- CreateTable
CREATE TABLE "ConceptMastery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "latestAttemptId" TEXT,
    "latestScore" INTEGER,
    "passingThreshold" INTEGER,
    "masteredAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConceptMastery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConceptMastery_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConceptMastery_latestAttemptId_fkey" FOREIGN KEY ("latestAttemptId") REFERENCES "QuizAttempt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ConceptMastery_latestAttemptId_key" ON "ConceptMastery"("latestAttemptId");

-- CreateIndex
CREATE INDEX "ConceptMastery_conceptId_masteredAt_idx" ON "ConceptMastery"("conceptId", "masteredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptMastery_userId_conceptId_key" ON "ConceptMastery"("userId", "conceptId");
