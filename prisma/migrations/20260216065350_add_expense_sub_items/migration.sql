-- CreateTable
CREATE TABLE "ExpenseSubItem" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "splitMode" "SplitMode" NOT NULL DEFAULT 'EVENLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseSubItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubItemPaidFor" (
    "subItemId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "shares" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SubItemPaidFor_pkey" PRIMARY KEY ("subItemId","participantId")
);

-- AddForeignKey
ALTER TABLE "ExpenseSubItem" ADD CONSTRAINT "ExpenseSubItem_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubItemPaidFor" ADD CONSTRAINT "SubItemPaidFor_subItemId_fkey" FOREIGN KEY ("subItemId") REFERENCES "ExpenseSubItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubItemPaidFor" ADD CONSTRAINT "SubItemPaidFor_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
