import {
  getBalances,
  getPublicBalances,
  getSettlementBalances,
  getSuggestedReimbursements,
} from './balances'

type MockExpense = Parameters<typeof getSettlementBalances>[0][number]

function makeExpense(
  overrides: Partial<MockExpense> & {
    id?: string
    title?: string
    amount: number
    paidById: string
    paidForIds: string[]
  },
): MockExpense {
  const {
    id = 'exp1',
    title = 'Test',
    amount,
    paidById,
    paidForIds,
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
