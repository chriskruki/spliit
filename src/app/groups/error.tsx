'use client'

import { AsyncButton } from '@/components/async-button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DatabaseZap } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { startTransition, useState } from 'react'

export default function GroupsError({ reset }: { reset: () => void }) {
  const t = useTranslations('Groups.Error')
  const router = useRouter()
  const [failed, setFailed] = useState(false)

  const wake = async () => {
    setFailed(false)
    const res = await fetch('/api/health/readiness', {
      cache: 'no-store',
    }).catch(() => null)
    if (!res?.ok) return setFailed(true)
    startTransition(() => {
      router.refresh()
      reset()
    })
  }

  return (
    <Alert>
      <DatabaseZap className="w-4 h-4" />
      <AlertTitle>{t('title')}</AlertTitle>
      <AlertDescription className="flex flex-col gap-4">
        <p>{t('text')}</p>
        {failed && <p className="text-destructive">{t('failed')}</p>}
        <div className="flex flex-wrap gap-2">
          <AsyncButton action={wake} loadingContent={t('waking')}>
            {t('wake')}
          </AsyncButton>
          <Button asChild variant="secondary">
            <Link href="/groups">{t('link')}</Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
