'use client'

import { Button } from '@/components/ui/button'
import { StraightBalanceItem } from '@/lib/balances'
import { Currency } from '@/lib/currency'
import { formatCurrency } from '@/lib/utils'
import { Participant } from '@prisma/client'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'

type Props = {
  items: StraightBalanceItem[]
  participants: Participant[]
  currency: Currency
  groupId: string
}

export function StraightBalancesList({
  items,
  participants,
  currency,
  groupId,
}: Props) {
  const locale = useLocale()
  const t = useTranslations('Balances.Straight')

  if (items.length === 0) {
    return <p className="text-sm pb-6">{t('noItems')}</p>
  }

  const getParticipant = (id: string) => participants.find((p) => p.id === id)

  return (
    <div className="text-sm">
      {items.map((item, index) => (
        <div className="py-4 flex justify-between" key={index}>
          <div className="flex flex-col gap-1 items-start sm:flex-row sm:items-baseline sm:gap-4">
            <div>
              {t.rich('owes', {
                from: getParticipant(item.from)?.name ?? '',
                to: getParticipant(item.to)?.name ?? '',
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
              {t('forExpense', { expense: item.expenseTitle })}
            </div>
            <Button variant="link" asChild className="-mx-4 -my-3">
              <Link
                href={`/groups/${groupId}/expenses/create?reimbursement=yes&from=${item.from}&to=${item.to}&amount=${item.amount}`}
              >
                {t('markAsPaid')}
              </Link>
            </Button>
          </div>
          <div className="tabular-nums whitespace-nowrap">
            {formatCurrency(currency, item.amount, locale)}
          </div>
        </div>
      ))}
    </div>
  )
}
