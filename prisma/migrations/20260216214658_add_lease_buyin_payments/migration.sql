-- CreateTable
CREATE TABLE "LeaseBuyInPayment" (
    "expenseId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,

    CONSTRAINT "LeaseBuyInPayment_pkey" PRIMARY KEY ("expenseId","participantId")
);

-- AddForeignKey
ALTER TABLE "LeaseBuyInPayment" ADD CONSTRAINT "LeaseBuyInPayment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseBuyInPayment" ADD CONSTRAINT "LeaseBuyInPayment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
