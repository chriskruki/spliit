'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LeaseItem } from '@/lib/balances'
import { Currency } from '@/lib/currency'
import { formatCurrency, formatDateOnly } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { Participant } from '@prisma/client'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'

type Props = {
  items: LeaseItem[]
  participants: Participant[]
  currency: Currency
  groupId: string
}

export function LeaseItemsList({
  items,
  participants,
  currency,
  groupId,
}: Props) {
  const locale = useLocale()
  const t = useTranslations('Balances.Lease')
  const utils = trpc.useUtils()
  const toggleBuyback = trpc.groups.expenses.toggleLeaseBuyback.useMutation({
    onSuccess: () => {
      utils.groups.balances.invalidate()
    },
  })

  if (items.length === 0) {
    return <p className="text-sm pb-6">{t('noItems')}</p>
  }

  const getParticipant = (id: string) => participants.find((p) => p.id === id)

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.expenseId} className="w-full">
          <CardContent className="pt-4 pb-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-sm">{item.itemName}</div>
                <div className="text-xs text-muted-foreground">
                  {t('owner', {
                    owner: getParticipant(item.ownerId)?.name ?? '',
                  })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">
                  {formatCurrency(currency, item.totalCost, locale)}
                </div>
                <span
                  className={`inline-block text-xs px-1.5 py-0.5 rounded-full ${
                    item.buybackCompleted
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                  }`}
                >
                  {item.buybackCompleted ? t('completed') : t('active')}
                </span>
              </div>
            </div>

            {item.buybackDate && (
              <div className="text-xs text-muted-foreground">
                {t('buybackDate', {
                  date: formatDateOnly(item.buybackDate, locale, {
                    dateStyle: 'medium',
                  }),
                })}
              </div>
            )}

            {item.buybackBreakdown.length > 0 && (
              <div className="border-t pt-2 mt-2">
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {t('buybackBreakdown')}
                </div>
                {item.buybackBreakdown.map((b) => (
                  <div
                    key={b.participantId}
                    className="flex items-center justify-between text-sm py-1"
                  >
                    <span>
                      {formatCurrency(currency, b.amount, locale)}{' '}
                      <span className="text-muted-foreground text-xs">
                        {t('owedTo', {
                          name: getParticipant(b.participantId)?.name ?? '',
                        })}
                      </span>
                    </span>
                    <Button variant="link" asChild className="-mx-2 -my-1 h-auto text-xs">
                      <Link
                        href={`/groups/${groupId}/expenses/create?reimbursement=yes&from=${item.ownerId}&to=${b.participantId}&amount=${b.amount}`}
                      >
                        {t('createReimbursement')}
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() =>
                  toggleBuyback.mutate({
                    groupId,
                    expenseId: item.expenseId,
                  })
                }
                disabled={toggleBuyback.isPending}
              >
                {item.buybackCompleted
                  ? t('toggleBuybackUndo')
                  : t('toggleBuyback')}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
