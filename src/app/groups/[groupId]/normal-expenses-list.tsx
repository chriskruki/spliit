import { Currency } from '@/lib/currency'
import { formatCurrency } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'

type NormalExpense = {
  id: string
  title: string
  amount: number
  expenseDate: Date
  paidById: string
  paidByName: string
}

type Props = {
  expenses: NormalExpense[]
  currency: Currency
  groupId: string
}

export function NormalExpensesList({ expenses, currency, groupId }: Props) {
  const locale = useLocale()
  const t = useTranslations('Balances.Normal')

  if (expenses.length === 0) {
    return <p className="text-sm pb-6">{t('noExpenses')}</p>
  }

  return (
    <div className="text-sm">
      {expenses.map((expense) => (
        <Link
          key={expense.id}
          href={`/groups/${groupId}/expenses/${expense.id}/edit`}
          className="flex items-baseline justify-between py-3 hover:bg-muted/50 -mx-2 px-2 rounded transition-colors"
        >
          <div className="flex flex-col gap-0.5 items-start sm:flex-row sm:items-baseline sm:gap-4 min-w-0">
            <span className="font-medium truncate max-w-[200px]">
              {expense.title}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('paidBy', { name: expense.paidByName })}
            </span>
          </div>
          <div className="tabular-nums whitespace-nowrap ml-4">
            {formatCurrency(currency, expense.amount, locale)}
          </div>
        </Link>
      ))}
    </div>
  )
}
