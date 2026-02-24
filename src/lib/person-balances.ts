import { LeaseItem, Reimbursement, StraightBalanceItem } from '@/lib/balances'

export type PersonDebtItem = {
  type: 'normal' | 'straight' | 'lease-buyin' | 'lease-buyback'
  amount: number
  expenseId?: string
  expenseTitle?: string
  leaseItemName?: string
  leaseExpenseId?: string
  buyInParticipantId?: string
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
): CreditorDebt[] {
  const creditorMap = new Map<string, PersonDebtItem[]>()

  const addItem = (creditorId: string, item: PersonDebtItem) => {
    if (!creditorMap.has(creditorId)) {
      creditorMap.set(creditorId, [])
    }
    creditorMap.get(creditorId)!.push(item)
  }

  // Normal: filter reimbursements where from === personId
  for (const r of reimbursements) {
    if (r.from === personId) {
      addItem(r.to, { type: 'normal', amount: r.amount })
    }
  }

  // Straight: filter where from === personId
  for (const s of straight) {
    if (s.from === personId) {
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
