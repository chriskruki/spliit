'use client'

import { BalancesList } from '@/app/groups/[groupId]/balances-list'
import { GrandTotalSummary } from '@/app/groups/[groupId]/grand-total-summary'
import { LeaseItemsList } from '@/app/groups/[groupId]/lease-items-list'
import { PersonBalanceView } from '@/app/groups/[groupId]/person-balance-view'
import { ReimbursementList } from '@/app/groups/[groupId]/reimbursement-list'
import { StraightBalancesList } from '@/app/groups/[groupId]/straight-balances-list'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { getCurrencyFromGroup } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Fragment, useEffect, useState } from 'react'
import { match } from 'ts-pattern'
import { useCurrentGroup } from '../current-group-context'

export default function BalancesAndReimbursements() {
  const utils = trpc.useUtils()
  const { groupId, group } = useCurrentGroup()
  const { data: balancesData, isLoading: balancesAreLoading } =
    trpc.groups.balances.list.useQuery({
      groupId,
    })
  const t = useTranslations('Balances')
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => {
    utils.groups.balances.invalidate()
  }, [utils])

  const isLoading = balancesAreLoading || !balancesData || !group

  const hasNormal =
    !isLoading &&
    (Object.keys(balancesData.balances).length > 0 ||
      balancesData.reimbursements.length > 0)
  const hasStraight = !isLoading && balancesData.straight.length > 0
  const hasLease = !isLoading && balancesData.lease.length > 0

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
        <TabsTrigger value="all">{t('PersonTabs.all')}</TabsTrigger>
        {group?.participants.map((p) => (
          <TabsTrigger key={p.id} value={p.id}>
            {p.name}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="all">
        {/* Grand Total Summary */}
        {!isLoading && (hasStraight || hasLease) && (
          <GrandTotalSummary
            totals={balancesData.totals}
            currency={getCurrencyFromGroup(group)}
          />
        )}

        {/* Normal Balances - Green */}
        <CollapsibleSection
          title={
            hasNormal || hasStraight || hasLease
              ? t('Normal.title')
              : t('title')
          }
          description={
            hasNormal || hasStraight || hasLease
              ? t('Normal.description')
              : t('description')
          }
          borderColor="border-l-green-500"
          showBorder={hasNormal || hasStraight || hasLease}
          defaultOpen={true}
        >
          {isLoading ? (
            <>
              <BalancesLoading
                participantCount={group?.participants.length}
              />
              <ReimbursementsLoading
                participantCount={group?.participants.length}
              />
            </>
          ) : (
            <>
              <BalancesList
                balances={balancesData.balances}
                participants={group.participants}
                currency={getCurrencyFromGroup(group)}
              />
              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2">
                  {t('Reimbursements.title')}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('Reimbursements.description')}
                </p>
                <ReimbursementList
                  reimbursements={balancesData.reimbursements}
                  participants={group.participants}
                  currency={getCurrencyFromGroup(group)}
                  groupId={groupId}
                />
              </div>
            </>
          )}
        </CollapsibleSection>

        {/* Straight Balances - Blue */}
        {(hasStraight || isLoading) && (
          <CollapsibleSection
            title={t('Straight.title')}
            description={t('Straight.description')}
            borderColor="border-l-blue-500"
            showBorder={true}
            defaultOpen={hasStraight}
          >
            {isLoading ? (
              <ReimbursementsLoading
                participantCount={group?.participants.length}
              />
            ) : (
              <StraightBalancesList
                items={balancesData.straight}
                participants={group.participants}
                currency={getCurrencyFromGroup(group)}
                groupId={groupId}
              />
            )}
          </CollapsibleSection>
        )}

        {/* Lease Items - Amber */}
        {(hasLease || isLoading) && (
          <CollapsibleSection
            title={t('Lease.title')}
            description={t('Lease.description')}
            borderColor="border-l-amber-500"
            showBorder={true}
            defaultOpen={hasLease}
          >
            {isLoading ? (
              <ReimbursementsLoading
                participantCount={group?.participants.length}
              />
            ) : (
              <LeaseItemsList
                items={balancesData.lease}
                participants={group.participants}
                currency={getCurrencyFromGroup(group)}
                groupId={groupId}
              />
            )}
          </CollapsibleSection>
        )}
      </TabsContent>

      {group?.participants.map((p) => (
        <TabsContent key={p.id} value={p.id}>
          {!isLoading && (
            <PersonBalanceView
              personId={p.id}
              reimbursements={balancesData.reimbursements}
              straight={balancesData.straight}
              lease={balancesData.lease}
              participants={group.participants}
              currency={getCurrencyFromGroup(group)}
              groupId={groupId}
            />
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}

function CollapsibleSection({
  title,
  description,
  borderColor,
  showBorder,
  defaultOpen,
  children,
}: {
  title: string
  description: string
  borderColor: string
  showBorder: boolean
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className={`mb-4 ${showBorder ? `border-l-4 ${borderColor}` : ''}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  open ? 'rotate-180' : ''
                }`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

const ReimbursementsLoading = ({
  participantCount = 3,
}: {
  participantCount?: number
}) => {
  return (
    <div className="flex flex-col">
      {Array(participantCount - 1)
        .fill(undefined)
        .map((_, index) => (
          <div key={index} className="flex justify-between py-5">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
    </div>
  )
}

const BalancesLoading = ({
  participantCount = 3,
}: {
  participantCount?: number
}) => {
  const barWidth = (index: number) =>
    match(index % 3)
      .with(0, () => 'w-1/3')
      .with(1, () => 'w-2/3')
      .otherwise(() => 'w-full')

  return (
    <div className="grid grid-cols-2 py-1 gap-y-2">
      {Array(participantCount)
        .fill(undefined)
        .map((_, index) =>
          index % 2 === 0 ? (
            <Fragment key={index}>
              <div className="flex items-center justify-end pr-2">
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="self-start">
                <Skeleton className={`h-7 ${barWidth(index)} rounded-l-none`} />
              </div>
            </Fragment>
          ) : (
            <Fragment key={index}>
              <div className="flex items-center justify-end">
                <Skeleton className={`h-7 ${barWidth(index)} rounded-r-none`} />
              </div>
              <div className="flex items-center pl-2">
                <Skeleton className="h-3 w-16" />
              </div>
            </Fragment>
          ),
        )}
    </div>
  )
}
