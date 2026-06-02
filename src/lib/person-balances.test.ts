import { NormalExpenseDetail, Reimbursement } from './balances'
import { getPersonDebts } from './person-balances'

describe('getPersonDebts - normal items carry normalDetails', () => {
  it('attaches matching normalDetails to a normal debt item', () => {
    const reimbursements: Reimbursement[] = [
      { from: 'B', to: 'A', amount: 800 },
    ]
    const normalDetails: NormalExpenseDetail[] = [
      { expenseId: 'e1', expenseTitle: 'Pizza', from: 'B', to: 'A', amount: 500 },
      { expenseId: 'e2', expenseTitle: 'Cab', from: 'B', to: 'A', amount: 300 },
    ]
    const debts = getPersonDebts('B', reimbursements, [], [], normalDetails)
    expect(debts).toHaveLength(1)
    const item = debts[0].items[0]
    expect(item.type).toBe('normal')
    expect(item.amount).toBe(800)
    expect(item.directNet).toBe(800)
    expect(item.normalDetails).toEqual([
      { expenseId: 'e1', expenseTitle: 'Pizza', amount: 500 },
      { expenseId: 'e2', expenseTitle: 'Cab', amount: 300 },
    ])
  })

  it('only attaches details matching this debtor and creditor', () => {
    const reimbursements: Reimbursement[] = [
      { from: 'B', to: 'A', amount: 500 },
    ]
    const normalDetails: NormalExpenseDetail[] = [
      { expenseId: 'e1', expenseTitle: 'Pizza', from: 'B', to: 'A', amount: 500 },
      { expenseId: 'e2', expenseTitle: 'Other', from: 'C', to: 'A', amount: 200 },
      { expenseId: 'e3', expenseTitle: 'Other', from: 'B', to: 'C', amount: 100 },
    ]
    const debts = getPersonDebts('B', reimbursements, [], [], normalDetails)
    expect(debts[0].items[0].normalDetails).toEqual([
      { expenseId: 'e1', expenseTitle: 'Pizza', amount: 500 },
    ])
  })

  it('omits normalDetails when none match (empty array)', () => {
    const reimbursements: Reimbursement[] = [
      { from: 'B', to: 'A', amount: 500 },
    ]
    const debts = getPersonDebts('B', reimbursements, [], [], [])
    // No matching normalDetails means directNet is 0, so a rebalance entry
    // is appended for the full suggested amount.
    expect(debts[0].items[0].normalDetails).toEqual([
      {
        expenseId: '__rebalance__A',
        expenseTitle: 'rebalance',
        amount: 500,
        rebalance: true,
      },
    ])
    expect(debts[0].items[0].directNet).toBe(0)
  })

  it('appends a reverse-direction offset entry alongside forward debts', () => {
    const reimbursements: Reimbursement[] = [
      { from: 'B', to: 'A', amount: 300 },
    ]
    const normalDetails: NormalExpenseDetail[] = [
      { expenseId: 'e1', expenseTitle: 'Pizza', from: 'B', to: 'A', amount: 500 },
      { expenseId: 'e2', expenseTitle: 'Cab', from: 'A', to: 'B', amount: 200 },
    ]
    const debts = getPersonDebts('B', reimbursements, [], [], normalDetails)
    const item = debts[0].items[0]
    expect(item.directNet).toBe(300)
    expect(item.normalDetails).toEqual([
      { expenseId: 'e1', expenseTitle: 'Pizza', amount: 500 },
      { expenseId: 'e2', expenseTitle: 'Cab', amount: 200, offset: true },
    ])
  })
})

describe('getPersonDebts - rebalance reconciliation', () => {
  it('appends a negative rebalance entry when suggested < direct pair-net', () => {
    // B has $200 direct pair-net debt to A but optimizer suggests only $115
    // (because some of B's debt routes through third parties).
    const reimbursements: Reimbursement[] = [
      { from: 'B', to: 'A', amount: 115 },
    ]
    const normalDetails: NormalExpenseDetail[] = [
      { expenseId: 'e1', expenseTitle: 'Rent', from: 'B', to: 'A', amount: 250 },
      { expenseId: 'e2', expenseTitle: 'Snacks', from: 'A', to: 'B', amount: 50 },
    ]
    const debts = getPersonDebts('B', reimbursements, [], [], normalDetails)
    const item = debts[0].items[0]
    expect(item.amount).toBe(115)
    expect(item.directNet).toBe(200)
    // Last entry is the rebalance: 115 - 200 = -85
    const last = item.normalDetails![item.normalDetails!.length - 1]
    expect(last.rebalance).toBe(true)
    expect(last.amount).toBe(-85)
    // The list now sums to the suggested amount
    const sum = item.normalDetails!.reduce(
      (s, d) => s + (d.offset ? -d.amount : d.amount),
      0,
    )
    expect(sum).toBe(115)
  })

  it('appends a positive rebalance entry when suggested > direct pair-net', () => {
    // B's direct pair-net to A is only $50 but optimizer routes more of B's
    // payments through A, so B owes A $115 in the suggested plan.
    const reimbursements: Reimbursement[] = [
      { from: 'B', to: 'A', amount: 115 },
    ]
    const normalDetails: NormalExpenseDetail[] = [
      { expenseId: 'e1', expenseTitle: 'Lunch', from: 'B', to: 'A', amount: 50 },
    ]
    const debts = getPersonDebts('B', reimbursements, [], [], normalDetails)
    const item = debts[0].items[0]
    expect(item.amount).toBe(115)
    expect(item.directNet).toBe(50)
    const last = item.normalDetails![item.normalDetails!.length - 1]
    expect(last.rebalance).toBe(true)
    expect(last.amount).toBe(65)
  })

  it('omits the rebalance entry when suggested equals direct pair-net', () => {
    const reimbursements: Reimbursement[] = [
      { from: 'B', to: 'A', amount: 100 },
    ]
    const normalDetails: NormalExpenseDetail[] = [
      { expenseId: 'e1', expenseTitle: 'Lunch', from: 'B', to: 'A', amount: 100 },
    ]
    const debts = getPersonDebts('B', reimbursements, [], [], normalDetails)
    const item = debts[0].items[0]
    expect(item.directNet).toBe(100)
    expect(item.normalDetails!.every((d) => !d.rebalance)).toBe(true)
  })
})
