'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LeaseItem, Reimbursement, StraightBalanceItem } from '@/lib/balances'
import { Currency } from '@/lib/currency'
import { getPersonDebts, PersonDebtItem } from '@/lib/person-balances'
import { formatCurrency } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { Participant } from '@prisma/client'
import { useLocale, useTranslations } from 'next-intl'
import Link from 'next/link'

type Props = {
  personId: string
  reimbursements: Reimbursement[]
  straight: StraightBalanceItem[]
  lease: LeaseItem[]
  participants: Participant[]
  currency: Currency
  groupId: string
}

export function PersonBalanceView({
  personId,
  reimbursements,
  straight,
  lease,
  participants,
  currency,
  groupId,
}: Props) {
  const locale = useLocale()
  const t = useTranslations('Balances.PersonTabs')
  const tLease = useTranslations('Balances.Lease')
  const tStraight = useTranslations('Balances.Straight')
  const tReimbursements = useTranslations('Balances.Reimbursements')
  const utils = trpc.useUtils()

  const toggleBuyIn = trpc.groups.expenses.toggleLeaseBuyIn.useMutation({
    onSuccess: () => {
      utils.groups.balances.invalidate()
    },
  })

  const debts = getPersonDebts(personId, reimbursements, straight, lease)

  const getParticipant = (id: string) => participants.find((p) => p.id === id)
  const personName = getParticipant(personId)?.name ?? ''

  if (debts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        {t('noDebts', { name: personName })}
      </p>
    )
  }

  const groupByType = (items: PersonDebtItem[]) => {
    const groups: Record<string, PersonDebtItem[]> = {}
    for (const item of items) {
      if (!groups[item.type]) groups[item.type] = []
      groups[item.type].push(item)
    }
    return groups
  }

  const typeConfig = {
    normal: { border: 'border-l-green-500', label: t('normalLabel') },
    straight: { border: 'border-l-blue-500', label: t('straightLabel') },
    'lease-buyin': { border: 'border-l-amber-500', label: t('leaseBuyInLabel') },
    'lease-buyback': { border: 'border-l-amber-500', label: t('leaseBuybackLabel') },
  } as const

  return (
    <div className="space-y-3">
      {debts.map((debt) => {
        const creditorName = getParticipant(debt.creditorId)?.name ?? ''
        const grouped = groupByType(debt.items)

        return (
          <Card key={debt.creditorId}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {t('owesTo', { creditor: creditorName })}
                </CardTitle>
                <span className="text-base font-semibold tabular-nums">
                  {formatCurrency(currency, debt.totalAmount, locale)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {Object.entries(grouped).map(([type, items]) => {
                const config = typeConfig[type as keyof typeof typeConfig]
                return (
                  <div
                    key={type}
                    className={`border-l-4 ${config.border} pl-3 space-y-1`}
                  >
                    <div className="text-xs font-medium text-muted-foreground">
                      {config.label}
                    </div>
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-sm py-1 gap-2"
                      >
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span className="tabular-nums">
                            {formatCurrency(currency, item.amount, locale)}
                          </span>
                          {item.type === 'straight' && item.expenseTitle && (
                            <span className="text-xs text-muted-foreground">
                              {t('forExpense', { expense: item.expenseTitle })}
                            </span>
                          )}
                          {(item.type === 'lease-buyin' ||
                            item.type === 'lease-buyback') &&
                            item.leaseItemName && (
                              <span className="text-xs text-muted-foreground">
                                {t('forItem', { item: item.leaseItemName })}
                              </span>
                            )}
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          {item.type === 'normal' && (
                            <Button
                              variant="link"
                              asChild
                              className="-mx-2 -my-1 h-auto text-xs"
                            >
                              <Link
                                href={`/groups/${groupId}/expenses/create?reimbursement=yes&from=${personId}&to=${debt.creditorId}&amount=${item.amount}`}
                              >
                                {tReimbursements('markAsPaid')}
                              </Link>
                            </Button>
                          )}
                          {item.type === 'straight' && (
                            <Button
                              variant="link"
                              asChild
                              className="-mx-2 -my-1 h-auto text-xs"
                            >
                              <Link
                                href={`/groups/${groupId}/expenses/create?reimbursement=yes&from=${personId}&to=${debt.creditorId}&amount=${item.amount}`}
                              >
                                {tStraight('markAsPaid')}
                              </Link>
                            </Button>
                          )}
                          {item.type === 'lease-buyin' && (
                            <>
                              <Button
                                variant="link"
                                asChild
                                className="-mx-2 -my-1 h-auto text-xs"
                              >
                                <Link
                                  href={`/groups/${groupId}/expenses/create?reimbursement=yes&from=${personId}&to=${debt.creditorId}&amount=${item.amount}`}
                                >
                                  {tLease('createReimbursement')}
                                </Link>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto py-0.5 px-1.5 text-xs"
                                onClick={() =>
                                  toggleBuyIn.mutate({
                                    groupId,
                                    expenseId: item.leaseExpenseId!,
                                    participantId: item.buyInParticipantId!,
                                  })
                                }
                                disabled={toggleBuyIn.isPending}
                              >
                                {tLease('toggleBuyInPaid')}
                              </Button>
                            </>
                          )}
                          {item.type === 'lease-buyback' && (
                            <Button
                              variant="link"
                              asChild
                              className="-mx-2 -my-1 h-auto text-xs"
                            >
                              <Link
                                href={`/groups/${groupId}/expenses/create?reimbursement=yes&from=${personId}&to=${debt.creditorId}&amount=${item.amount}`}
                              >
                                {tLease('createReimbursement')}
                              </Link>
                            </Button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
