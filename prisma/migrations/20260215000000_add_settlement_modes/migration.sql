-- CreateEnum
CREATE TYPE "SettlementMode" AS ENUM ('NORMAL', 'STRAIGHT', 'LEASE');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "settlementMode" "SettlementMode" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "leaseOwnerId" TEXT,
ADD COLUMN     "leaseBuybackDate" DATE,
ADD COLUMN     "leaseBuybackCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leaseItemName" TEXT;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_leaseOwnerId_fkey" FOREIGN KEY ("leaseOwnerId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
