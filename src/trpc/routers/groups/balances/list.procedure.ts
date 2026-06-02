import { getGroupExpenses } from '@/lib/api'
import { getSettlementBalances } from '@/lib/balances'
import { baseProcedure } from '@/trpc/init'
import { z } from 'zod'

export const listGroupBalancesProcedure = baseProcedure
  .input(z.object({ groupId: z.string().min(1) }))
  .query(async ({ input: { groupId } }) => {
    const expenses = await getGroupExpenses(groupId)
    const settlementBalances = getSettlementBalances(expenses)

    const normalExpenses = expenses
      .filter((e) => (e.settlementMode ?? 'NORMAL') === 'NORMAL')
      .map((e) => ({
        id: e.id,
        title: e.title,
        amount: e.amount,
        expenseDate: e.expenseDate,
        paidById: e.paidBy.id,
        paidByName: e.paidBy.name,
      }))

    return {
      balances: settlementBalances.normal.publicBalances,
      reimbursements: settlementBalances.normal.reimbursements,
      normalDetails: settlementBalances.normal.normalDetails,
      normalExpenses,
      straight: settlementBalances.straight,
      lease: settlementBalances.lease,
      totals: settlementBalances.totals,
    }
  })
