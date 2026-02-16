import { getGroupExpenses } from '@/lib/api'

export function getTotalGroupSpending(
  expenses: NonNullable<Awaited<ReturnType<typeof getGroupExpenses>>>,
): number {
  return expenses.reduce(
    (total, expense) =>
      expense.isReimbursement ? total : total + expense.amount,
    0,
  )
}

export function getTotalActiveUserPaidFor(
  activeUserId: string | null,
  expenses: NonNullable<Awaited<ReturnType<typeof getGroupExpenses>>>,
): number {
  return expenses.reduce(
    (total, expense) =>
      expense.paidBy.id === activeUserId && !expense.isReimbursement
        ? total + expense.amount
        : total,
    0,
  )
}

type Expense = NonNullable<Awaited<ReturnType<typeof getGroupExpenses>>>[number]

type PaidForEntry = {
  participant: { id: string; name: string }
  shares: number
}

function calculateShareForSplit(
  participantId: string | null,
  amount: number,
  splitMode: string,
  paidFors: PaidForEntry[],
): number {
  const userPaidFor = paidFors.find(
    (paidFor) => paidFor.participant.id === participantId,
  )

  if (!userPaidFor) return 0

  const shares = Number(userPaidFor.shares)

  switch (splitMode) {
    case 'EVENLY':
      return amount / paidFors.length
    case 'BY_AMOUNT':
      return shares
    case 'BY_PERCENTAGE':
      return (amount * shares) / 10000
    case 'BY_SHARES': {
      const totalShares = paidFors.reduce(
        (sum, paidFor) => sum + Number(paidFor.shares),
        0,
      )
      return (amount * shares) / totalShares
    }
    default:
      return 0
  }
}

export function calculateShare(
  participantId: string | null,
  expense: Pick<
    Expense,
    'amount' | 'paidFor' | 'splitMode' | 'isReimbursement'
  > & {
    subItems?: Array<{
      amount: number
      splitMode: string
      paidFor: PaidForEntry[]
    }>
  },
): number {
  if (expense.isReimbursement) return 0

  const subItems = expense.subItems ?? []
  const subItemTotal = subItems.reduce((sum, si) => sum + si.amount, 0)
  const remainderAmount = expense.amount - subItemTotal

  let total = 0

  // Remainder uses parent split
  if (remainderAmount > 0) {
    total += calculateShareForSplit(
      participantId,
      remainderAmount,
      expense.splitMode,
      expense.paidFor as PaidForEntry[],
    )
  }

  // Each sub-item uses its own split
  for (const subItem of subItems) {
    total += calculateShareForSplit(
      participantId,
      subItem.amount,
      subItem.splitMode,
      subItem.paidFor,
    )
  }

  return total
}

export function getTotalActiveUserShare(
  activeUserId: string | null,
  expenses: NonNullable<Awaited<ReturnType<typeof getGroupExpenses>>>,
): number {
  const total = expenses.reduce(
    (sum, expense) => sum + calculateShare(activeUserId, expense),
    0,
  )

  return parseFloat(total.toFixed(2))
}
