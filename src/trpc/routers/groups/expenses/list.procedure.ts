import { getGroupExpenses } from '@/lib/api'
import { baseProcedure } from '@/trpc/init'
import { SettlementMode } from '@prisma/client'
import { z } from 'zod'

export const listGroupExpensesProcedure = baseProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      cursor: z.number().optional(),
      limit: z.number().optional(),
      filter: z.string().optional(),
      settlementMode: z
        .enum<SettlementMode, [SettlementMode, ...SettlementMode[]]>(
          Object.values(SettlementMode) as any,
        )
        .optional(),
    }),
  )
  .query(
    async ({
      input: { groupId, cursor = 0, limit = 10, filter, settlementMode },
    }) => {
      const expenses = await getGroupExpenses(groupId, {
        offset: cursor,
        length: limit + 1,
        filter,
        settlementMode,
      })
      return {
        expenses: expenses.slice(0, limit).map((expense) => ({
          ...expense,
          createdAt: new Date(expense.createdAt),
          expenseDate: new Date(expense.expenseDate),
        })),
        hasMore: !!expenses[limit],
        nextCursor: cursor + limit,
      }
    },
  )
