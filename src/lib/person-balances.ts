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
  rebalance?: boolean
}

export type PersonDebtItem = {
  type: 'normal' | 'straight' | 'lease-buyin' | 'lease-buyback'
  // For type 'normal': the optimizer's suggested-reimbursement amount
  // (routed through the full balance graph). For straight/lease: the
  // direct amount owed.
  amount: number
  expenseId?: string
  expenseTitle?: string
  leaseItemName?: string
  leaseExpenseId?: string
  buyInParticipantId?: string
  normalDetails?: PersonNormalDetail[]
  // For type 'normal': direct pairwise net (forward − reverse) between
  // debtor and creditor. May differ from `amount` because the optimizer
  // can route payments through third parties.
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
  // Build pair buckets from normalDetails so we know the direct pair-net
  // for every counterparty (forward minus reverse). This is the source for
  // both the per-expense list and the rebalance reconciliation.
  type PairBucket = {
    forward: PersonNormalDetail[]
    reverse: PersonNormalDetail[]
    net: number
  }
  const pairBuckets = new Map<string, PairBucket>()
  const bucketFor = (otherId: string): PairBucket => {
    let b = pairBuckets.get(otherId)
    if (!b) {
      b = { forward: [], reverse: [], net: 0 }
      pairBuckets.set(otherId, b)
    }
    return b
  }
  for (const d of normalDetails) {
    if (d.from === personId) {
      const b = bucketFor(d.to)
      b.forward.push({
        expenseId: d.expenseId,
        expenseTitle: d.expenseTitle,
        amount: d.amount,
      })
      b.net += d.amount
    } else if (d.to === personId) {
      const b = bucketFor(d.from)
      b.reverse.push({
        expenseId: d.expenseId,
        expenseTitle: d.expenseTitle,
        amount: d.amount,
        offset: true,
      })
      b.net -= d.amount
    }
  }

  const creditorMap = new Map<string, PersonDebtItem[]>()
  const addItem = (creditorId: string, item: PersonDebtItem) => {
    if (!creditorMap.has(creditorId)) {
      creditorMap.set(creditorId, [])
    }
    creditorMap.get(creditorId)!.push(item)
  }

  // Normal: one debt item per optimizer-suggested reimbursement where
  // personId is the debtor. The headline amount is the suggested payment;
  // we attach the direct pair-net and the per-expense breakdown alongside,
  // plus a synthetic rebalance entry that reconciles the two whenever the
  // optimizer routed part of the debt through a third party.
  for (const r of reimbursements) {
    if (r.from !== personId) continue
    const bucket = pairBuckets.get(r.to)
    const forward = bucket?.forward ?? []
    const reverse = bucket?.reverse ?? []
    const directNet = bucket?.net ?? 0
    const details: PersonNormalDetail[] = [...forward, ...reverse]
    const rebalanceAmount = r.amount - directNet
    if (Math.round(rebalanceAmount) !== 0) {
      details.push({
        expenseId: `__rebalance__${r.to}`,
        expenseTitle: 'rebalance',
        amount: rebalanceAmount,
        rebalance: true,
      })
    }
    addItem(r.to, {
      type: 'normal',
      amount: r.amount,
      directNet,
      normalDetails: details,
    })
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
