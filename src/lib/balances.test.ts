import {
  getBalances,
  getPublicBalances,
  getSettlementBalances,
  getSuggestedReimbursements,
} from './balances'

type MockExpense = Parameters<typeof getSettlementBalances>[0][number]

type SubItemInput = {
  title?: string
  amount: number
  splitMode?: string
  paidForIds: string[]
  shares?: number[]
}

function makeSubItem(input: SubItemInput) {
  const { title = 'Sub-item', amount, splitMode = 'EVENLY', paidForIds, shares } = input
  return {
    id: `sub-${Math.random().toString(36).slice(2)}`,
    title,
    amount,
    splitMode,
    paidFor: paidForIds.map((pid, i) => ({
      participant: { id: pid, name: pid },
      shares: shares ? shares[i] : 1,
    })),
  }
}

function makeExpense(
  overrides: Omit<Partial<MockExpense>, 'subItems'> & {
    id?: string
    title?: string
    amount: number
    paidById: string
    paidForIds: string[]
    subItems?: SubItemInput[]
  },
): MockExpense {
  const {
    id = 'exp1',
    title = 'Test',
    amount,
    paidById,
    paidForIds,
    subItems: subItemInputs,
    ...rest
  } = overrides
  return {
    id,
    title,
    amount,
    splitMode: 'EVENLY',
    settlementMode: 'NORMAL',
    isReimbursement: false,
    expenseDate: new Date(),
    createdAt: new Date(),
    category: null,
    categoryId: 0,
    recurrenceRule: 'NONE',
    leaseOwnerId: null,
    leaseBuybackDate: null,
    leaseBuybackCompleted: false,
    leaseItemName: null,
    leaseOwner: null,
    paidBy: { id: paidById, name: paidById },
    paidFor: paidForIds.map((pid) => ({
      participant: { id: pid, name: pid },
      shares: 1,
    })),
    subItems: (subItemInputs ?? []).map(makeSubItem),
    _count: { documents: 0 },
    ...rest,
  } as MockExpense
}

describe('getBalances - existing behavior preserved', () => {
  it('computes even split between 2 participants', () => {
    const expenses = [
      makeExpense({ amount: 1000, paidById: 'A', paidForIds: ['A', 'B'] }),
    ]
    const balances = getBalances(expenses)
    expect(balances['A'].total).toBe(500)
    expect(balances['B'].total).toBe(-500)
  })

  it('handles multiple expenses', () => {
    const expenses = [
      makeExpense({
        id: 'e1',
        amount: 1000,
        paidById: 'A',
        paidForIds: ['A', 'B'],
      }),
      makeExpense({
        id: 'e2',
        amount: 600,
        paidById: 'B',
        paidForIds: ['A', 'B'],
      }),
    ]
    const balances = getBalances(expenses)
    // A paid 1000, owed 800 (500+300) → +200
    // B paid 600, owed 800 (500+300) → -200
    expect(balances['A'].total).toBe(200)
    expect(balances['B'].total).toBe(-200)
  })
})

describe('getSuggestedReimbursements', () => {
  it('suggests B pays A', () => {
    const balances = {
      A: { paid: 1000, paidFor: 500, total: 500 },
      B: { paid: 0, paidFor: 500, total: -500 },
    }
    const reimbursements = getSuggestedReimbursements(balances)
    expect(reimbursements).toHaveLength(1)
    expect(reimbursements[0]).toEqual({ from: 'B', to: 'A', amount: 500 })
  })
})

describe('getSettlementBalances - partitioning', () => {
  it('partitions NORMAL expenses into normal balances', () => {
    const expenses = [
      makeExpense({
        amount: 1000,
        paidById: 'A',
        paidForIds: ['A', 'B'],
        settlementMode: 'NORMAL',
      }),
    ]
    const result = getSettlementBalances(expenses)
    expect(result.normal.reimbursements).toHaveLength(1)
    expect(result.straight).toHaveLength(0)
    expect(result.lease).toHaveLength(0)
  })

  it('partitions STRAIGHT expenses into straight items', () => {
    const expenses = [
      makeExpense({
        amount: 1000,
        paidById: 'A',
        paidForIds: ['A', 'B'],
        settlementMode: 'STRAIGHT',
      }),
    ]
    const result = getSettlementBalances(expenses)
    expect(result.normal.reimbursements).toHaveLength(0)
    expect(result.straight).toHaveLength(1)
    expect(result.straight[0].from).toBe('B')
    expect(result.straight[0].to).toBe('A')
    expect(result.straight[0].amount).toBe(500)
  })

  it('partitions LEASE expenses into lease items', () => {
    const expenses = [
      makeExpense({
        amount: 3000,
        paidById: 'A',
        paidForIds: ['A', 'B', 'C'],
        settlementMode: 'LEASE',
        leaseOwnerId: 'A',
        leaseItemName: 'Samsung TV',
        leaseBuybackDate: new Date('2026-06-01'),
        leaseBuybackCompleted: false,
      }),
    ]
    const result = getSettlementBalances(expenses)
    expect(result.normal.reimbursements).toHaveLength(0)
    expect(result.straight).toHaveLength(0)
    expect(result.lease).toHaveLength(1)
    expect(result.lease[0].itemName).toBe('Samsung TV')
    expect(result.lease[0].ownerId).toBe('A')
    expect(result.lease[0].buybackBreakdown).toHaveLength(2)
    expect(result.lease[0].buybackBreakdown[0].amount).toBe(1000)
    expect(result.lease[0].buybackBreakdown[1].amount).toBe(1000)
  })

  it('handles mixed modes correctly', () => {
    const expenses = [
      makeExpense({
        id: 'e1',
        amount: 1000,
        paidById: 'A',
        paidForIds: ['A', 'B'],
        settlementMode: 'NORMAL',
      }),
      makeExpense({
        id: 'e2',
        amount: 600,
        paidById: 'A',
        paidForIds: ['A', 'B'],
        settlementMode: 'STRAIGHT',
      }),
      makeExpense({
        id: 'e3',
        amount: 3000,
        paidById: 'A',
        paidForIds: ['A', 'B'],
        settlementMode: 'LEASE',
        leaseOwnerId: 'A',
        leaseItemName: 'Couch',
        leaseBuybackDate: new Date('2026-12-01'),
        leaseBuybackCompleted: false,
      }),
    ]
    const result = getSettlementBalances(expenses)
    expect(result.normal.reimbursements).toHaveLength(1)
    expect(result.normal.reimbursements[0].amount).toBe(500)
    expect(result.straight).toHaveLength(1)
    expect(result.straight[0].amount).toBe(300)
    expect(result.lease).toHaveLength(1)
    expect(result.lease[0].buybackBreakdown).toHaveLength(1)
    expect(result.lease[0].buybackBreakdown[0].amount).toBe(1500)
  })

  it('treats expenses without settlementMode as NORMAL (backward compat)', () => {
    const expense = makeExpense({
      amount: 1000,
      paidById: 'A',
      paidForIds: ['A', 'B'],
    })
    // Simulate old expense without settlementMode
    ;(expense as any).settlementMode = undefined
    const result = getSettlementBalances([expense])
    expect(result.normal.reimbursements).toHaveLength(1)
    expect(result.straight).toHaveLength(0)
    expect(result.lease).toHaveLength(0)
  })
})

describe('straight mode - per-expense line items', () => {
  it('creates one line item per non-payer participant', () => {
    const expenses = [
      makeExpense({
        amount: 3000,
        paidById: 'A',
        paidForIds: ['A', 'B', 'C'],
        settlementMode: 'STRAIGHT',
      }),
    ]
    const result = getSettlementBalances(expenses)
    // B and C each owe A 1000
    expect(result.straight).toHaveLength(2)
    expect(result.straight[0]).toMatchObject({
      from: 'B',
      to: 'A',
      amount: 1000,
    })
    expect(result.straight[1]).toMatchObject({
      from: 'C',
      to: 'A',
      amount: 1000,
    })
  })

  it('does not net across expenses', () => {
    const expenses = [
      makeExpense({
        id: 'e1',
        amount: 1000,
        paidById: 'A',
        paidForIds: ['A', 'B'],
        settlementMode: 'STRAIGHT',
      }),
      makeExpense({
        id: 'e2',
        amount: 1000,
        paidById: 'B',
        paidForIds: ['A', 'B'],
        settlementMode: 'STRAIGHT',
      }),
    ]
    const result = getSettlementBalances(expenses)
    // Should have 2 items, not netted to 0
    expect(result.straight).toHaveLength(2)
    expect(result.straight[0]).toMatchObject({
      from: 'B',
      to: 'A',
      amount: 500,
    })
    expect(result.straight[1]).toMatchObject({
      from: 'A',
      to: 'B',
      amount: 500,
    })
  })
})

describe('lease mode - buyback breakdown', () => {
  it('computes correct buyback amounts', () => {
    const expenses = [
      makeExpense({
        amount: 4000,
        paidById: 'A',
        paidForIds: ['A', 'B', 'C', 'D'],
        settlementMode: 'LEASE',
        leaseOwnerId: 'A',
        leaseItemName: 'TV',
        leaseBuybackDate: new Date('2026-06-01'),
        leaseBuybackCompleted: false,
      }),
    ]
    const result = getSettlementBalances(expenses)
    const lease = result.lease[0]
    expect(lease.buybackBreakdown).toHaveLength(3)
    // Each non-owner gets 1000 back
    for (const b of lease.buybackBreakdown) {
      expect(b.amount).toBe(1000)
    }
  })

  it('uses paidBy as owner when leaseOwnerId is null', () => {
    const expenses = [
      makeExpense({
        amount: 2000,
        paidById: 'A',
        paidForIds: ['A', 'B'],
        settlementMode: 'LEASE',
        leaseOwnerId: null,
        leaseItemName: 'Couch',
        leaseBuybackDate: null,
        leaseBuybackCompleted: false,
      }),
    ]
    const result = getSettlementBalances(expenses)
    expect(result.lease[0].ownerId).toBe('A')
    expect(result.lease[0].buybackBreakdown).toHaveLength(1)
    expect(result.lease[0].buybackBreakdown[0].participantId).toBe('B')
    expect(result.lease[0].buybackBreakdown[0].amount).toBe(1000)
  })
})

describe('sub-items - balance calculation', () => {
  it('expense with no sub-items behaves the same as before', () => {
    const expenses = [
      makeExpense({ amount: 1000, paidById: 'A', paidForIds: ['A', 'B'] }),
    ]
    const balances = getBalances(expenses)
    expect(balances['A'].total).toBe(500)
    expect(balances['B'].total).toBe(-500)
  })

  it('one sub-item with remainder assigned to payer', () => {
    // $30 expense, A pays. Parent split = only A.
    // Sub-item: $8 pretzels split evenly between A and B
    // Remainder: $22 goes to A (parent split)
    // A paid 3000, A owes: 2200 (remainder) + 400 (half pretzels) = 2600
    // B owes: 400 (half pretzels)
    const expenses = [
      makeExpense({
        amount: 3000,
        paidById: 'A',
        paidForIds: ['A'],
        subItems: [
          { amount: 800, paidForIds: ['A', 'B'], splitMode: 'EVENLY' },
        ],
      }),
    ]
    const balances = getBalances(expenses)
    expect(balances['A'].paid).toBe(3000)
    expect(balances['A'].paidFor).toBe(2600)
    expect(balances['A'].total).toBe(400) // paid 3000, owed 2600
    expect(balances['B'].paidFor).toBe(400)
    expect(balances['B'].total).toBe(-400)
  })

  it('multiple sub-items with different split modes', () => {
    // $100 expense, A pays. Parent split = evenly A, B, C
    // Sub-item 1: $20 split evenly between A and B
    // Sub-item 2: $30 BY_AMOUNT: B=2000, C=1000
    // Remainder: $50 evenly between A, B, C (≈1667, 1667, 1666)
    const expenses = [
      makeExpense({
        amount: 10000,
        paidById: 'A',
        paidForIds: ['A', 'B', 'C'],
        subItems: [
          { amount: 2000, paidForIds: ['A', 'B'], splitMode: 'EVENLY' },
          {
            amount: 3000,
            paidForIds: ['B', 'C'],
            splitMode: 'BY_AMOUNT',
            shares: [2000, 1000],
          },
        ],
      }),
    ]
    const balances = getBalances(expenses)
    // A: paid 10000, paidFor = 1000 (sub1) + 0 (sub2) + remainder share
    // B: paid 0, paidFor = 1000 (sub1) + 2000 (sub2) + remainder share
    // C: paid 0, paidFor = 0 (sub1) + 1000 (sub2) + remainder share (last gets remainder)
    expect(balances['A'].paid).toBe(10000)
    expect(balances['A'].paidFor).toBe(2667)
    expect(balances['B'].paidFor).toBe(4667)
    expect(balances['C'].paidFor).toBe(2667) // C is last, gets the rounding remainder
    // Totals must sum to approximately zero (rounding may cause ±1)
    const totalBalance =
      balances['A'].total + balances['B'].total + balances['C'].total
    expect(Math.abs(totalBalance)).toBeLessThanOrEqual(1)
  })

  it('sub-items with BY_PERCENTAGE split', () => {
    // $100 expense. Sub-item: $40 split 75%/25% between A and B
    // Remainder: $60 evenly between A and B
    const expenses = [
      makeExpense({
        amount: 10000,
        paidById: 'A',
        paidForIds: ['A', 'B'],
        subItems: [
          {
            amount: 4000,
            paidForIds: ['A', 'B'],
            splitMode: 'BY_PERCENTAGE',
            shares: [7500, 2500], // 75%, 25%
          },
        ],
      }),
    ]
    const balances = getBalances(expenses)
    // A: paidFor = 3000 (75% of 4000) + 3000 (half remainder) = 6000
    // B: paidFor = 1000 (25% of 4000) + 3000 (half remainder) = 4000
    expect(balances['A'].paidFor).toBe(6000)
    expect(balances['B'].paidFor).toBe(4000)
  })

  it('sub-items summing to exactly the parent amount (zero remainder)', () => {
    // $50 expense. Two sub-items totaling $50. No remainder.
    const expenses = [
      makeExpense({
        amount: 5000,
        paidById: 'A',
        paidForIds: ['A', 'B'],
        subItems: [
          { amount: 2000, paidForIds: ['A', 'B'], splitMode: 'EVENLY' },
          { amount: 3000, paidForIds: ['B'], splitMode: 'EVENLY' },
        ],
      }),
    ]
    const balances = getBalances(expenses)
    // A: paidFor = 1000 (sub1) + 0 (sub2) = 1000
    // B: paidFor = 1000 (sub1) + 3000 (sub2) = 4000
    expect(balances['A'].paidFor).toBe(1000)
    expect(balances['B'].paidFor).toBe(4000)
    expect(balances['A'].total).toBe(4000) // paid 5000 - owed 1000
    expect(balances['B'].total).toBe(-4000)
  })

  it('sub-item amount equals parent amount (zero remainder)', () => {
    const expenses = [
      makeExpense({
        amount: 1000,
        paidById: 'A',
        paidForIds: ['A', 'B'],
        subItems: [
          { amount: 1000, paidForIds: ['B'], splitMode: 'EVENLY' },
        ],
      }),
    ]
    const balances = getBalances(expenses)
    // All goes to B via sub-item, nothing via remainder
    expect(balances['A'].paidFor).toBe(0)
    expect(balances['B'].paidFor).toBe(1000)
    expect(balances['A'].total).toBe(1000)
    expect(balances['B'].total).toBe(-1000)
  })
})
