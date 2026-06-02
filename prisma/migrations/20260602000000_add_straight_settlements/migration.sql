-- CreateTable
CREATE TABLE "StraightSettlement" (
    "expenseId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,

    CONSTRAINT "StraightSettlement_pkey" PRIMARY KEY ("expenseId","participantId")
);

-- AddForeignKey
ALTER TABLE "StraightSettlement" ADD CONSTRAINT "StraightSettlement_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StraightSettlement" ADD CONSTRAINT "StraightSettlement_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
