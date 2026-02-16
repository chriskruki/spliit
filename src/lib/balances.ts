import { getGroupExpenses } from '@/lib/api'
import { Participant } from '@prisma/client'
import { match } from 'ts-pattern'

export type Balances = Record<
  Participant['id'],
  { paid: number; paidFor: number; total: number }
>

export type Reimbursement = {
  from: Participant['id']
  to: Participant['id']
  amount: number
}

export type StraightBalanceItem = {
  expenseId: string
  expenseTitle: string
  from: string
  to: string
  amount: number
}

export type LeaseItem = {
  expenseId: string
  itemName: string
  totalCost: number
  ownerId: string
  buybackDate: Date | null
  buybackCompleted: boolean
  buybackBreakdown: Array<{ participantId: string; amount: number }>
}

export type SettlementBalances = {
  normal: {
    balances: Balances
    reimbursements: Reimbursement[]
    publicBalances: Balances
  }
  straight: StraightBalanceItem[]
  lease: LeaseItem[]
  totals: {
    totalOwed: number
    totalOwedToYou: number
    net: number
  }
}

type GroupExpenses = NonNullable<Awaited<ReturnType<typeof getGroupExpenses>>>

export function getBalances(expenses: GroupExpenses): Balances {
  const balances: Balances = {}

  for (const expense of expenses) {
    const paidBy = expense.paidBy.id
    const paidFors = expense.paidFor

    if (!balances[paidBy]) balances[paidBy] = { paid: 0, paidFor: 0, total: 0 }
    balances[paidBy].paid += expense.amount

    const totalPaidForShares = paidFors.reduce(
      (sum, paidFor) => sum + paidFor.shares,
      0,
    )
    let remaining = expense.amount
    paidFors.forEach((paidFor, index) => {
      if (!balances[paidFor.participant.id])
        balances[paidFor.participant.id] = { paid: 0, paidFor: 0, total: 0 }

      const isLast = index === paidFors.length - 1

      const [shares, totalShares] = match(expense.splitMode)
        .with('EVENLY', () => [1, paidFors.length])
        .with('BY_SHARES', () => [paidFor.shares, totalPaidForShares])
        .with('BY_PERCENTAGE', () => [paidFor.shares, totalPaidForShares])
        .with('BY_AMOUNT', () => [paidFor.shares, totalPaidForShares])
        .exhaustive()

      const dividedAmount = isLast
        ? remaining
        : (expense.amount * shares) / totalShares
      remaining -= dividedAmount
      balances[paidFor.participant.id].paidFor += dividedAmount
    })
  }

  // rounding and add total
  for (const participantId in balances) {
    // add +0 to avoid negative zeros
    balances[participantId].paidFor =
      Math.round(balances[participantId].paidFor) + 0
    balances[participantId].paid = Math.round(balances[participantId].paid) + 0

    balances[participantId].total =
      balances[participantId].paid - balances[participantId].paidFor
  }
  return balances
}

export function getPublicBalances(reimbursements: Reimbursement[]): Balances {
  const balances: Balances = {}
  reimbursements.forEach((reimbursement) => {
    if (!balances[reimbursement.from])
      balances[reimbursement.from] = { paid: 0, paidFor: 0, total: 0 }

    if (!balances[reimbursement.to])
      balances[reimbursement.to] = { paid: 0, paidFor: 0, total: 0 }

    balances[reimbursement.from].paidFor += reimbursement.amount
    balances[reimbursement.from].total -= reimbursement.amount

    balances[reimbursement.to].paid += reimbursement.amount
    balances[reimbursement.to].total += reimbursement.amount
  })
  return balances
}

/**
 * A comparator that is stable across reimbursements.
 * This ensures that a participant executing a suggested reimbursement
 * does not result in completely new repayment suggestions.
 */
function compareBalancesForReimbursements(b1: any, b2: any): number {
  // positive balances come before negative balances
  if (b1.total > 0 && 0 > b2.total) {
    return -1
  } else if (b2.total > 0 && 0 > b1.total) {
    return 1
  }
  // if signs match, sort based on userid
  return b1.participantId < b2.participantId ? -1 : 1
}

export function getSuggestedReimbursements(
  balances: Balances,
): Reimbursement[] {
  const balancesArray = Object.entries(balances)
    .map(([participantId, { total }]) => ({ participantId, total }))
    .filter((b) => b.total !== 0)
  balancesArray.sort(compareBalancesForReimbursements)
  const reimbursements: Reimbursement[] = []
  while (balancesArray.length > 1) {
    const first = balancesArray[0]
    const last = balancesArray[balancesArray.length - 1]
    const amount = first.total + last.total
    if (first.total > -last.total) {
      reimbursements.push({
        from: last.participantId,
        to: first.participantId,
        amount: -last.total,
      })
      first.total = amount
      balancesArray.pop()
    } else {
      reimbursements.push({
        from: last.participantId,
        to: first.participantId,
        amount: first.total,
      })
      last.total = amount
      balancesArray.shift()
    }
  }
  return reimbursements.filter(({ amount }) => Math.round(amount) + 0 !== 0)
}

function computeParticipantShares(expense: GroupExpenses[number]) {
  const paidFors = expense.paidFor
  const totalPaidForShares = paidFors.reduce(
    (sum, paidFor) => sum + paidFor.shares,
    0,
  )
  let remaining = expense.amount
  return paidFors.map((paidFor, index) => {
    const isLast = index === paidFors.length - 1
    const [shares, totalShares] = match(expense.splitMode)
      .with('EVENLY', () => [1, paidFors.length])
      .with('BY_SHARES', () => [paidFor.shares, totalPaidForShares])
      .with('BY_PERCENTAGE', () => [paidFor.shares, totalPaidForShares])
      .with('BY_AMOUNT', () => [paidFor.shares, totalPaidForShares])
      .exhaustive()
    const amount = isLast
      ? remaining
      : (expense.amount * shares) / totalShares
    remaining -= amount
    return { participantId: paidFor.participant.id, amount: Math.round(amount) }
  })
}

function getStraightBalanceItems(
  expenses: GroupExpenses,
): StraightBalanceItem[] {
  const items: StraightBalanceItem[] = []
  for (const expense of expenses) {
    const shares = computeParticipantShares(expense)
    for (const share of shares) {
      if (share.participantId !== expense.paidBy.id && share.amount !== 0) {
        items.push({
          expenseId: expense.id,
          expenseTitle: expense.title,
          from: share.participantId,
          to: expense.paidBy.id,
          amount: share.amount,
        })
      }
    }
  }
  return items
}

function getLeaseItems(expenses: GroupExpenses): LeaseItem[] {
  return expenses.map((expense) => {
    const ownerId = expense.leaseOwnerId ?? expense.paidBy.id
    const shares = computeParticipantShares(expense)
    const buybackBreakdown = shares
      .filter((s) => s.participantId !== ownerId && s.amount !== 0)
      .map((s) => ({ participantId: s.participantId, amount: s.amount }))

    return {
      expenseId: expense.id,
      itemName: expense.leaseItemName ?? expense.title,
      totalCost: expense.amount,
      ownerId,
      buybackDate: expense.leaseBuybackDate,
      buybackCompleted: expense.leaseBuybackCompleted,
      buybackBreakdown,
    }
  })
}

export function getSettlementBalances(
  expenses: GroupExpenses,
): SettlementBalances {
  const normalExpenses: GroupExpenses = []
  const straightExpenses: GroupExpenses = []
  const leaseExpenses: GroupExpenses = []

  for (const expense of expenses) {
    const mode = expense.settlementMode ?? 'NORMAL'
    if (mode === 'STRAIGHT') {
      straightExpenses.push(expense)
    } else if (mode === 'LEASE') {
      leaseExpenses.push(expense)
    } else {
      normalExpenses.push(expense)
    }
  }

  const balances = getBalances(normalExpenses)
  const reimbursements = getSuggestedReimbursements(balances)
  const publicBalances = getPublicBalances(reimbursements)

  const straightItems = getStraightBalanceItems(straightExpenses)
  const leaseItems = getLeaseItems(leaseExpenses)

  // Compute grand totals
  let totalOwed = 0
  let totalOwedToYou = 0

  for (const r of reimbursements) {
    totalOwed += r.amount
  }
  for (const item of straightItems) {
    totalOwed += item.amount
  }
  for (const item of leaseItems) {
    if (!item.buybackCompleted) {
      for (const b of item.buybackBreakdown) {
        totalOwed += b.amount
      }
    }
  }

  return {
    normal: { balances, reimbursements, publicBalances },
    straight: straightItems,
    lease: leaseItems,
    totals: {
      totalOwed,
      totalOwedToYou,
      net: totalOwed - totalOwedToYou,
    },
  }
}
