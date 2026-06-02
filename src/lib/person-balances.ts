import {
  LeaseItem,
  NormalExpenseDetail,
  Reimbursement,
  StraightBalanceItem,
} from '@/lib/balances'

export type PersonNormalDetail = {
  expenseId: string
  expenseTitle: string
  amount: number
  offset?: boolean
}

export type PersonDebtItem = {
  type: 'normal' | 'straight' | 'lease-buyin' | 'lease-buyback'
  amount: number
  expenseId?: string
  expenseTitle?: string
  leaseItemName?: string
  leaseExpenseId?: string
  buyInParticipantId?: string
  normalDetails?: PersonNormalDetail[]
  // For type 'normal': pairwise net (forward − reverse) between debtor and
  // creditor. `amount` is the optimizer's suggested-reimbursement value
  // (which routes through the full balance graph and may not match this
  // pair's direct debt); `directNet` is the sum of the per-expense list.
  directNet?: number
}

export type CreditorDebt = {
  creditorId: string
  totalAmount: number
  items: PersonDebtItem[]
}

export function getPersonDebts(
  personId: string,
  reimbursements: Reimbursement[],
  straight: StraightBalanceItem[],
  lease: LeaseItem[],
  normalDetails: NormalExpenseDetail[] = [],
): CreditorDebt[] {
  const creditorMap = new Map<string, PersonDebtItem[]>()

  const addItem = (creditorId: string, item: PersonDebtItem) => {
    if (!creditorMap.has(creditorId)) {
      creditorMap.set(creditorId, [])
    }
    creditorMap.get(creditorId)!.push(item)
  }

  // Normal: filter reimbursements where from === personId.
  // Include both directions so the per-expense breakdown reconciles to the
  // (netted) reimbursement amount: forward items (you owe them) plus
  // offsetting reverse items (they owe you) flagged with `offset: true`.
  for (const r of reimbursements) {
    if (r.from === personId) {
      const forward = normalDetails
        .filter((d) => d.from === personId && d.to === r.to)
        .map((d) => ({
          expenseId: d.expenseId,
          expenseTitle: d.expenseTitle,
          amount: d.amount,
        }))
      const reverse = normalDetails
        .filter((d) => d.from === r.to && d.to === personId)
        .map((d) => ({
          expenseId: d.expenseId,
          expenseTitle: d.expenseTitle,
          amount: d.amount,
          offset: true,
        }))
      const directNet =
        forward.reduce((s, d) => s + d.amount, 0) -
        reverse.reduce((s, d) => s + d.amount, 0)
      addItem(r.to, {
        type: 'normal',
        amount: r.amount,
        normalDetails: [...forward, ...reverse],
        directNet,
      })
    }
  }

  // Straight: filter where from === personId and not yet settled
  for (const s of straight) {
    if (s.from === personId && !s.paid) {
      addItem(s.to, {
        type: 'straight',
        amount: s.amount,
        expenseId: s.expenseId,
        expenseTitle: s.expenseTitle,
      })
    }
  }

  // Lease buy-in: filter buyInBreakdown where participantId === personId && !paid
  for (const item of lease) {
    for (const b of item.buyInBreakdown) {
      if (b.participantId === personId && !b.paid) {
        addItem(item.ownerId, {
          type: 'lease-buyin',
          amount: b.amount,
          leaseItemName: item.itemName,
          leaseExpenseId: item.expenseId,
          buyInParticipantId: b.participantId,
        })
      }
    }

    // Lease buyback: where ownerId === personId && buybackActive && !buybackCompleted
    if (item.ownerId === personId && item.buybackActive && !item.buybackCompleted) {
      for (const b of item.buybackBreakdown) {
        addItem(b.participantId, {
          type: 'lease-buyback',
          amount: b.amount,
          leaseItemName: item.itemName,
          leaseExpenseId: item.expenseId,
        })
      }
    }
  }

  // Group by creditor, sum amounts, sort descending
  const result: CreditorDebt[] = []
  creditorMap.forEach((items, creditorId) => {
    const totalAmount = items.reduce(
      (sum: number, item: PersonDebtItem) => sum + item.amount,
      0,
    )
    result.push({ creditorId, totalAmount, items })
  })

  result.sort((a, b) => b.totalAmount - a.totalAmount)
  return result
}
