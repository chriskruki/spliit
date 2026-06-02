import { prisma } from '@/lib/prisma'
import { baseProcedure } from '@/trpc/init'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

export const toggleStraightSettlementProcedure = baseProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      expenseId: z.string().min(1),
      participantId: z.string().min(1),
    }),
  )
  .mutation(async ({ input: { groupId, expenseId, participantId } }) => {
    const expense = await prisma.expense.findFirst({
      where: { id: expenseId, groupId },
    })

    if (!expense) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Expense not found',
      })
    }

    if (expense.settlementMode !== 'STRAIGHT') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Expense is not a straight-settle expense',
      })
    }

    const existing = await prisma.straightSettlement.findUnique({
      where: {
        expenseId_participantId: { expenseId, participantId },
      },
    })

    if (existing) {
      return prisma.straightSettlement.delete({
        where: {
          expenseId_participantId: { expenseId, participantId },
        },
      })
    }

    return prisma.straightSettlement.create({
      data: { expenseId, participantId },
    })
  })
