import { getGroupExpenses } from '@/lib/api'
import { getSettlementBalances } from '@/lib/balances'
import { baseProcedure } from '@/trpc/init'
import { z } from 'zod'

export const listGroupBalancesProcedure = baseProcedure
  .input(z.object({ groupId: z.string().min(1) }))
  .query(async ({ input: { groupId } }) => {
    const expenses = await getGroupExpenses(groupId)
    const settlementBalances = getSettlementBalances(expenses)

    return {
      balances: settlementBalances.normal.publicBalances,
      reimbursements: settlementBalances.normal.reimbursements,
      straight: settlementBalances.straight,
      lease: settlementBalances.lease,
      totals: settlementBalances.totals,
    }
  })
