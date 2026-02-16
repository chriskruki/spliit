import { prisma } from '@/lib/prisma'
import { baseProcedure } from '@/trpc/init'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

export const toggleLeaseBuybackProcedure = baseProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      expenseId: z.string().min(1),
    }),
  )
  .mutation(async ({ input: { groupId, expenseId } }) => {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, groupId },
    })

    if (!expense) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Expense not found',
      })
    }

    if (expense.settlementMode !== 'LEASE') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Expense is not a lease',
      })
    }

    return prisma.expense.update({
      where: { id: expenseId },
      data: {
        leaseBuybackCompleted: !expense.leaseBuybackCompleted,
      },
    })
  })
