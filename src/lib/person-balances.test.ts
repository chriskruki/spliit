import { NormalExpenseDetail, Reimbursement } from './balances'
import { getPersonDebts } from './person-balances'

describe('getPersonDebts - normal items carry normalDetails', () => {
  it('attaches matching normalDetails to a normal debt item', () => {
    const reimbursements: Reimbursement[] = [{ from: 'B', to: 'A', amount: 800 }]
    const normalDetails: NormalExpenseDetail[] = [
      { expenseId: 'e1', expenseTitle: 'Pizza', from: 'B', to: 'A', amount: 500 },
      { expenseId: 'e2', expenseTitle: 'Cab', from: 'B', to: 'A', amount: 300 },
    ]
    const debts = getPersonDebts('B', reimbursements, [], [], normalDetails)
    expect(debts).toHaveLength(1)
    const item = debts[0].items[0]
    expect(item.type).toBe('normal')
    expect(item.normalDetails).toEqual([
      { expenseId: 'e1', expenseTitle: 'Pizza', amount: 500 },
      { expenseId: 'e2', expenseTitle: 'Cab', amount: 300 },
    ])
  })

  it('only attaches details matching this debtor and creditor', () => {
    const reimbursements: Reimbursement[] = [{ from: 'B', to: 'A', amount: 500 }]
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
    const reimbursements: Reimbursement[] = [{ from: 'B', to: 'A', amount: 500 }]
    const debts = getPersonDebts('B', reimbursements, [], [], [])
    expect(debts[0].items[0].normalDetails).toEqual([])
  })
})
