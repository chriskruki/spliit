'use client'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Currency } from '@/lib/currency'
import { formatCurrency } from '@/lib/utils'
import { useLocale, useTranslations } from 'next-intl'

type Props = {
  totals: {
    totalOwed: number
    totalOwedToYou: number
    net: number
  }
  currency: Currency
}

export function GrandTotalSummary({ totals, currency }: Props) {
  const t = useTranslations('Balances.GrandTotal')
  const locale = useLocale()

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">{t('totalOwed')}</span>
          <span className="font-semibold tabular-nums">
            {formatCurrency(currency, totals.totalOwed, locale)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{t('note')}</p>
      </CardContent>
    </Card>
  )
}
