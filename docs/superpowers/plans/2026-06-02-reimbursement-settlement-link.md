# Reimbursement Settlement Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a reimbursement explicitly target one outstanding straight item or lease buy-in so saving the reimbursement also marks that target as settled. Editing or deleting the reimbursement tears the settlement down and reapplies the current link.

**Architecture:** Add two nullable columns (`settlesExpenseId`, `settlesParticipantId`) to `Expense`. `createExpense`/`updateExpense`/`deleteExpense` apply settlement side-effects (insert/delete `StraightSettlement` or `LeaseBuyInPayment` rows) in the same Prisma transaction as the expense write. Balance/derivation code excludes reimbursements that carry a settle link — the link is the source of truth, the reimbursement is audit-only and must not double-count. A new tRPC query lists outstanding (debtor → creditor) targets so the expense form can render a single-select. The form pre-fills the select from `?settle=...&settleParticipant=...` URL params; the existing "Reimburse" buttons append them.

**Tech Stack:** Prisma (PostgreSQL), tRPC, zod, Next.js app router, React Hook Form, shadcn UI primitives, jest.

**Scope:** Settlement link supports **STRAIGHT items** and **LEASE buy-ins** only. Lease buyback uses a global `leaseBuybackCompleted` flag (not per-participant) and is out of scope; buyback "Reimburse" buttons keep their current plain-reimbursement behavior.

---

## File Structure

**New files:**
- `prisma/migrations/20260603000000_add_reimbursement_settlement_link/migration.sql` — adds the two columns
- `src/trpc/routers/groups/expenses/settlement-targets.procedure.ts` — query for outstanding targets between a (debtor, creditor) pair
- `src/components/settle-target-select.tsx` — single-select component used inside the expense form

**Modified files:**
- `prisma/schema.prisma` — declare the new columns on `Expense`
- `src/lib/schemas.ts` — extend `expenseFormSchema`
- `src/lib/api.ts` — `createExpense`, `updateExpense`, `deleteExpense` apply settlement side-effects in a transaction
- `src/lib/balances.ts` — skip reimbursements with `settlesExpenseId !== null` in `getBalances`, `getNormalExpenseDetails`, and `getStraightBalanceItems`
- `src/trpc/routers/groups/expenses/index.ts` — register the new procedure
- `src/app/groups/[groupId]/expenses/expense-form.tsx` — render `SettleTargetSelect` when `isReimbursement` is true; consume new URL params
- `src/app/groups/[groupId]/straight-balances-list.tsx` — Reimburse link adds `&settle=<expenseId>&settleParticipant=<debtorId>`
- `src/app/groups/[groupId]/person-balance-view.tsx` — same for straight & lease-buyin Reimburse links
- `src/app/groups/[groupId]/lease-items-list.tsx` — same for lease-buyin Reimburse links
- `src/lib/balances.test.ts` — new unit tests
- `messages/en-US.json` — UI strings for the select

---

## Important Cross-Task Conventions

- **Column names:** `settlesExpenseId` (String?, FK to Expense.id, onDelete: SetNull) and `settlesParticipantId` (String?, FK to Participant.id, onDelete: SetNull).
- **URL params on Reimburse links:** `&settle=<targetExpenseId>&settleParticipant=<debtorParticipantId>`. The debtor is the participant whose share is being settled (i.e., who "owes"). For straight items, that's `item.from`. For lease buy-ins, that's the buy-in participant id.
- **Reimbursement settlement-mode:** when a reimbursement has a settle link, the form forces `settlementMode = 'NORMAL'`. The reimbursement is excluded from balance/derivation code anyway, so its mode is moot mathematically — keeping it `NORMAL` avoids requiring lease fields.
- **Tear-down/re-apply rule:** on update/delete, the *old* `(settlesExpenseId, settlesParticipantId)` is unconditionally torn down (idempotent delete of the matching `StraightSettlement` / `LeaseBuyInPayment` row). Then if the new values are set, the corresponding row is created. This means a user who manually toggled a target's settlement and then edits/removes the reimbursement loses the manual flip — acceptable trade for simplicity.

---

## Task 1: Add prisma columns and migration

**Files:**
- Modify: `prisma/schema.prisma` (the `Expense` model)
- Create: `prisma/migrations/20260603000000_add_reimbursement_settlement_link/migration.sql`

- [ ] **Step 1: Add columns to the Expense model**

Edit `prisma/schema.prisma`. Inside `model Expense { ... }`, add the two columns near the other settlement-related fields (e.g., right after `straightSettlements StraightSettlement[]`):

```prisma
  settlesExpenseId      String?
  settlesExpense        Expense?  @relation("ExpenseSettles", fields: [settlesExpenseId], references: [id], onDelete: SetNull)
  settledByReimbursements Expense[] @relation("ExpenseSettles")
  settlesParticipantId  String?
  settlesParticipant    Participant? @relation("ExpenseSettlesParticipant", fields: [settlesParticipantId], references: [id], onDelete: SetNull)
```

Then add the back-relation to `Participant`:

```prisma
  settlingReimbursements Expense[] @relation("ExpenseSettlesParticipant")
```

- [ ] **Step 2: Write the migration SQL**

Create the migration file with this content (the timestamp prefix must come *before* any future schema migrations, so increment if needed):

```sql
-- AlterTable
ALTER TABLE "Expense" ADD COLUMN "settlesExpenseId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "settlesParticipantId" TEXT;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_settlesExpenseId_fkey" FOREIGN KEY ("settlesExpenseId") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_settlesParticipantId_fkey" FOREIGN KEY ("settlesParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 3: Regenerate the Prisma client and verify types**

Run: `npx prisma generate`
Expected: `Prisma Client generated`
Then run: `npx tsc --noEmit`
Expected: `TypeScript compilation completed`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260603000000_add_reimbursement_settlement_link/migration.sql
git commit -m "feat(reimbursement): add settle-link columns to Expense"
```

---

## Task 2: Skip settlement-linked reimbursements from balance/derivation (TDD)

**Files:**
- Test: `src/lib/balances.test.ts`
- Modify: `src/lib/balances.ts`

- [ ] **Step 1: Write the failing tests**

Append these tests to `src/lib/balances.test.ts`. First, extend `MockExpense` fixtures by passing `settlesExpenseId` through `overrides`:

```typescript
describe('settlement-linked reimbursements are excluded', () => {
  it('omits settle-linked reimbursements from getBalances', () => {
    const expenses = [
      makeExpense({
        id: 'orig',
        amount: 1000,
        paidById: 'A',
        paidForIds: ['A', 'B'],
        settlementMode: 'STRAIGHT',
      }),
      makeExpense({
        id: 'reimb',
        amount: 500,
        paidById: 'B',
        paidForIds: ['A'],
        isReimbursement: true,
        settlementMode: 'NORMAL',
        settlesExpenseId: 'orig',
        settlesParticipantId: 'B',
      }),
    ]
    const balances = getBalances(expenses)
    // Without the exclusion, the reimbursement would shift normal balances
    // by ±500. With it, normal balances should be 0 across the board.
    expect(balances['A']?.total ?? 0).toBe(0)
    expect(balances['B']?.total ?? 0).toBe(0)
  })

  it('omits settle-linked reimbursements from getNormalExpenseDetails', () => {
    const expenses = [
      makeExpense({
        id: 'reimb',
        amount: 500,
        paidById: 'B',
        paidForIds: ['A'],
        isReimbursement: true,
        settlesExpenseId: 'orig',
        settlesParticipantId: 'B',
      }),
    ]
    expect(getNormalExpenseDetails(expenses)).toEqual([])
  })

  it('omits settle-linked reimbursements from getStraightBalanceItems', () => {
    const expenses = [
      makeExpense({
        id: 'reimb',
        amount: 500,
        paidById: 'B',
        paidForIds: ['A'],
        isReimbursement: true,
        settlementMode: 'STRAIGHT',
        settlesExpenseId: 'orig',
        settlesParticipantId: 'B',
      }),
    ]
    const result = getSettlementBalances(expenses)
    expect(result.straight).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `rtk proxy npx jest src/lib/balances.test.ts -t "settlement-linked reimbursements"`
Expected: 3 failures — `getBalances` returns non-zero, `getNormalExpenseDetails` returns 1 item, `getStraightBalanceItems` returns 1 item.

- [ ] **Step 3: Add an exclusion helper and apply it in the three loops**

Edit `src/lib/balances.ts`. Near the top of the file (after the type declarations, before any function that walks expenses), add:

```typescript
function isSettleLinkedReimbursement(expense: GroupExpenses[number]): boolean {
  return Boolean(expense.isReimbursement && (expense as any).settlesExpenseId)
}
```

(The `as any` is required only until Prisma client types propagate everywhere. Once Step 4 of Task 1 has run and types are regenerated, you can drop it — `getGroupExpenses` already returns all scalar columns by virtue of `select` defaults? Verify: look at `src/lib/api.ts:447` — fields are explicitly selected. If `settlesExpenseId` is not in the select, add it; see Task 4.)

Then add the early-skip to the top of each of these loops:

- `getBalances` (`src/lib/balances.ts:~140` — the `for (const expense of expenses)` loop): add `if (isSettleLinkedReimbursement(expense)) continue` at the top of the loop body.
- `getNormalExpenseDetails` (`src/lib/balances.ts:~264`): same.
- `getStraightBalanceItems` (`src/lib/balances.ts:~284`): same.

- [ ] **Step 4: Re-run tests to verify they pass**

Run: `rtk proxy npx jest src/lib/balances.test.ts`
Expected: all tests pass (including the existing 14 plus the 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/balances.ts src/lib/balances.test.ts
git commit -m "feat(balances): skip settle-linked reimbursements from balance calc"
```

---

## Task 3: Extend `getGroupExpenses` select to include the new columns

**Files:**
- Modify: `src/lib/api.ts:447-510` (the `getGroupExpenses` function)

- [ ] **Step 1: Add the columns to the select**

Edit `src/lib/api.ts`. Inside the `select: { ... }` object of `prisma.expense.findMany`, add (near the existing scalar fields):

```typescript
      settlesExpenseId: true,
      settlesParticipantId: true,
```

- [ ] **Step 2: Drop the `as any` cast in `isSettleLinkedReimbursement`**

Edit `src/lib/balances.ts` and change the helper to:

```typescript
function isSettleLinkedReimbursement(expense: GroupExpenses[number]): boolean {
  return Boolean(expense.isReimbursement && expense.settlesExpenseId)
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: `TypeScript compilation completed`

- [ ] **Step 4: Re-run balance tests**

Run: `rtk proxy npx jest src/lib/balances.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.ts src/lib/balances.ts
git commit -m "feat(api): include settle-link columns in getGroupExpenses select"
```

---

## Task 4: Extend `expenseFormSchema` with the new fields and validation

**Files:**
- Modify: `src/lib/schemas.ts:50-321`

- [ ] **Step 1: Add the optional fields to the schema**

Edit `src/lib/schemas.ts`. Inside `expenseFormSchema` (the `.object({ ... })` block), add right after `isReimbursement: z.boolean(),`:

```typescript
    settlesExpenseId: z.string().optional(),
    settlesParticipantId: z.string().optional(),
```

- [ ] **Step 2: Add cross-field validation in `.superRefine`**

Inside the existing `.superRefine((expense, ctx) => { ... })` block, append:

```typescript
    // settle-link consistency: both fields must be set together, and only
    // when the expense is a reimbursement.
    const hasExpense = Boolean(expense.settlesExpenseId)
    const hasParticipant = Boolean(expense.settlesParticipantId)
    if (hasExpense !== hasParticipant) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'settleLinkIncomplete',
        path: ['settlesExpenseId'],
      })
    }
    if ((hasExpense || hasParticipant) && !expense.isReimbursement) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'settleLinkRequiresReimbursement',
        path: ['settlesExpenseId'],
      })
    }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: `TypeScript compilation completed`

- [ ] **Step 4: Commit**

```bash
git add src/lib/schemas.ts
git commit -m "feat(schemas): add settle-link fields to expense form schema"
```

---

## Task 5: Apply settle-link side-effects in `createExpense`

**Files:**
- Modify: `src/lib/api.ts:36-139` (the `createExpense` function)

- [ ] **Step 1: Wrap creation in a transaction and apply the side-effect**

Replace the current `return prisma.expense.create({ ... })` block at the end of `createExpense` with a transactional version that:
1. Creates the expense (passing `settlesExpenseId` and `settlesParticipantId` through).
2. If both settle fields are set, looks up the target expense's `settlementMode` and writes the matching settlement row.

Concretely, change the final `return prisma.expense.create({...})` to:

```typescript
  return prisma.$transaction(async (tx) => {
    const created = await tx.expense.create({
      data: {
        // ...all existing fields unchanged...
        settlesExpenseId: expenseFormValues.settlesExpenseId ?? null,
        settlesParticipantId: expenseFormValues.settlesParticipantId ?? null,
      },
    })

    if (
      expenseFormValues.settlesExpenseId &&
      expenseFormValues.settlesParticipantId
    ) {
      await applySettlementSideEffect(
        tx,
        expenseFormValues.settlesExpenseId,
        expenseFormValues.settlesParticipantId,
      )
    }

    return created
  })
```

Then, near the top of `src/lib/api.ts` (after imports, before `createExpense`), add the helper:

```typescript
async function applySettlementSideEffect(
  tx: Prisma.TransactionClient,
  targetExpenseId: string,
  participantId: string,
): Promise<void> {
  const target = await tx.expense.findUnique({
    where: { id: targetExpenseId },
    select: { settlementMode: true, groupId: true },
  })
  if (!target) {
    throw new Error(`Settle target expense not found: ${targetExpenseId}`)
  }
  if (target.settlementMode === 'STRAIGHT') {
    await tx.straightSettlement.upsert({
      where: {
        expenseId_participantId: {
          expenseId: targetExpenseId,
          participantId,
        },
      },
      create: { expenseId: targetExpenseId, participantId },
      update: {},
    })
  } else if (target.settlementMode === 'LEASE') {
    await tx.leaseBuyInPayment.upsert({
      where: {
        expenseId_participantId: {
          expenseId: targetExpenseId,
          participantId,
        },
      },
      create: { expenseId: targetExpenseId, participantId },
      update: {},
    })
  } else {
    throw new Error(
      `Settle target ${targetExpenseId} has unsupported settlementMode: ${target.settlementMode}`,
    )
  }
}
```

You'll need to import `Prisma` from `@prisma/client` if it isn't already.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: `TypeScript compilation completed`

- [ ] **Step 3: Manual verification (no integration test infra exists)**

Start the dev server: `make local`
In the browser, on a group with at least one outstanding STRAIGHT debt:
1. Click "Reimburse" on a straight item (URL won't yet include `?settle=...` — those wires land in Task 9–10, but you can hand-construct the URL: append `&settle=<expenseId>&settleParticipant=<debtorId>`).
2. Submit the form.
3. Reload the balances tab. The original straight item should now be marked paid (struck through).

If verifying lease buy-ins, do the same on a lease buy-in row.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): apply settlement side-effect on reimbursement create"
```

---

## Task 6: Apply tear-down + re-apply in `updateExpense`

**Files:**
- Modify: `src/lib/api.ts:183-end` (the `updateExpense` function)

- [ ] **Step 1: Read previous settle values, then tear down + re-apply in a transaction**

Locate the final `return prisma.expense.update({ ... })` block in `updateExpense`. Before that, the function fetches `existingExpense`. Confirm `existingExpense` includes `settlesExpenseId` and `settlesParticipantId` — look at `getExpense` in `src/lib/api.ts`; if those scalars aren't explicitly selected, add them.

Wrap the final update in a transaction that:
1. Tears down the *previous* settle link (if any).
2. Applies the *new* settle link (if any).
3. Updates the expense row.

Replace `return prisma.expense.update({ ... })` with:

```typescript
  return prisma.$transaction(async (tx) => {
    // Tear down the previous link if it existed.
    if (
      existingExpense.settlesExpenseId &&
      existingExpense.settlesParticipantId
    ) {
      await tearDownSettlementSideEffect(
        tx,
        existingExpense.settlesExpenseId,
        existingExpense.settlesParticipantId,
      )
    }

    const updated = await tx.expense.update({
      where: { id: expenseId },
      data: {
        // ...all existing update fields unchanged...
        settlesExpenseId: expenseFormValues.settlesExpenseId ?? null,
        settlesParticipantId: expenseFormValues.settlesParticipantId ?? null,
      },
    })

    if (
      expenseFormValues.settlesExpenseId &&
      expenseFormValues.settlesParticipantId
    ) {
      await applySettlementSideEffect(
        tx,
        expenseFormValues.settlesExpenseId,
        expenseFormValues.settlesParticipantId,
      )
    }

    return updated
  })
```

Add the tear-down helper near `applySettlementSideEffect`:

```typescript
async function tearDownSettlementSideEffect(
  tx: Prisma.TransactionClient,
  targetExpenseId: string,
  participantId: string,
): Promise<void> {
  const target = await tx.expense.findUnique({
    where: { id: targetExpenseId },
    select: { settlementMode: true },
  })
  if (!target) return // target deleted; nothing to tear down
  if (target.settlementMode === 'STRAIGHT') {
    await tx.straightSettlement.deleteMany({
      where: { expenseId: targetExpenseId, participantId },
    })
  } else if (target.settlementMode === 'LEASE') {
    await tx.leaseBuyInPayment.deleteMany({
      where: { expenseId: targetExpenseId, participantId },
    })
  }
}
```

(Use `deleteMany` not `delete` so a missing row doesn't throw — tear-down is idempotent.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: `TypeScript compilation completed`

- [ ] **Step 3: Manual verification**

In the dev server:
1. Create a settle-linked reimbursement (per Task 5's manual verification).
2. Edit the reimbursement and change `settlesExpenseId`/`settlesParticipantId` (via dev tools or the form once Task 8 lands).
3. Reload balances. The originally-settled item should now be unsettled; the new target should now be settled.
4. Edit the reimbursement once more and clear the settle link entirely. Reload — both items should be unsettled.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): tear-down + re-apply settlement on reimbursement update"
```

---

## Task 7: Tear down on `deleteExpense`

**Files:**
- Modify: `src/lib/api.ts:141-157` (the `deleteExpense` function)

- [ ] **Step 1: Fetch settle link before deleting, then tear down in a transaction**

Replace the body of `deleteExpense` with:

```typescript
export async function deleteExpense(
  groupId: string,
  expenseId: string,
  participantId?: string,
) {
  const existingExpense = await getExpense(groupId, expenseId)
  await logActivity(groupId, ActivityType.DELETE_EXPENSE, {
    participantId,
    expenseId,
    data: existingExpense?.title,
  })

  await prisma.$transaction(async (tx) => {
    if (
      existingExpense?.settlesExpenseId &&
      existingExpense?.settlesParticipantId
    ) {
      await tearDownSettlementSideEffect(
        tx,
        existingExpense.settlesExpenseId,
        existingExpense.settlesParticipantId,
      )
    }
    await tx.expense.delete({
      where: { id: expenseId },
      include: { paidFor: true, paidBy: true },
    })
  })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: `TypeScript compilation completed`

- [ ] **Step 3: Manual verification**

In the dev server:
1. Create a settle-linked reimbursement; confirm the target is marked paid.
2. Delete the reimbursement.
3. Reload — the target should be unsettled again.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api): tear down settlement when deleting a reimbursement"
```

---

## Task 8: tRPC query — outstanding settlement targets for a (debtor, creditor) pair

**Files:**
- Create: `src/trpc/routers/groups/expenses/settlement-targets.procedure.ts`
- Modify: `src/trpc/routers/groups/expenses/index.ts`

- [ ] **Step 1: Write the procedure**

Create `src/trpc/routers/groups/expenses/settlement-targets.procedure.ts`:

```typescript
import { getGroupExpenses } from '@/lib/api'
import { getSettlementBalances } from '@/lib/balances'
import { baseProcedure } from '@/trpc/init'
import { z } from 'zod'

export type SettlementTarget = {
  expenseId: string
  expenseTitle: string
  amount: number
  kind: 'straight' | 'lease-buyin'
}

export const settlementTargetsProcedure = baseProcedure
  .input(
    z.object({
      groupId: z.string().min(1),
      debtorId: z.string().min(1),
      creditorId: z.string().min(1),
    }),
  )
  .query(async ({ input: { groupId, debtorId, creditorId } }) => {
    const expenses = await getGroupExpenses(groupId)
    const settlement = getSettlementBalances(expenses)

    const targets: SettlementTarget[] = []

    for (const item of settlement.straight) {
      if (item.paid) continue
      if (item.from !== debtorId || item.to !== creditorId) continue
      targets.push({
        expenseId: item.expenseId,
        expenseTitle: item.expenseTitle,
        amount: item.amount,
        kind: 'straight',
      })
    }

    for (const lease of settlement.lease) {
      if (lease.ownerId !== creditorId) continue
      for (const b of lease.buyInBreakdown) {
        if (b.paid) continue
        if (b.participantId !== debtorId) continue
        targets.push({
          expenseId: lease.expenseId,
          expenseTitle: lease.itemName,
          amount: b.amount,
          kind: 'lease-buyin',
        })
      }
    }

    return targets
  })
```

- [ ] **Step 2: Register the procedure**

Edit `src/trpc/routers/groups/expenses/index.ts`. Add the import and register under `groupExpensesRouter`:

```typescript
import { settlementTargetsProcedure } from '@/trpc/routers/groups/expenses/settlement-targets.procedure'

export const groupExpensesRouter = createTRPCRouter({
  // ...existing entries...
  settlementTargets: settlementTargetsProcedure,
})
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: `TypeScript compilation completed`

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/groups/expenses/settlement-targets.procedure.ts src/trpc/routers/groups/expenses/index.ts
git commit -m "feat(trpc): query for outstanding settlement targets per pair"
```

---

## Task 9: Build the `SettleTargetSelect` component

**Files:**
- Create: `src/components/settle-target-select.tsx`
- Modify: `messages/en-US.json` (add strings)

- [ ] **Step 1: Add translation strings**

Edit `messages/en-US.json`. Find the `ExpenseForm` block (or the closest equivalent — search for `"reimbursement":` near top of `Expense` section). Add inside it:

```json
      "settleLink": {
        "label": "Settles which debt?",
        "placeholder": "Choose an outstanding debt (optional)",
        "none": "Don't link to a specific debt",
        "straightLabel": "Straight",
        "leaseLabel": "Lease buy-in",
        "noTargets": "No outstanding straight/lease debts between these participants."
      }
```

Path inside the JSON: `Expenses.ExpenseForm.settleLink`. If the `ExpenseForm` namespace doesn't exist exactly here, place it under whatever block holds existing form labels — search `messages/en-US.json` for `"paidBy"` to find it.

- [ ] **Step 2: Build the component**

Create `src/components/settle-target-select.tsx`:

```typescript
'use client'

import { Currency } from '@/lib/currency'
import { formatCurrency } from '@/lib/utils'
import { trpc } from '@/trpc/client'
import { useLocale, useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  groupId: string
  debtorId: string | undefined
  creditorId: string | undefined
  currency: Currency
  value: { expenseId?: string; participantId?: string }
  onChange: (value: { expenseId?: string; participantId?: string }) => void
}

const NONE_VALUE = '__none__'

export function SettleTargetSelect({
  groupId,
  debtorId,
  creditorId,
  currency,
  value,
  onChange,
}: Props) {
  const t = useTranslations('Expenses.ExpenseForm.settleLink')
  const locale = useLocale()

  const enabled = Boolean(debtorId && creditorId && debtorId !== creditorId)
  const { data: targets } = trpc.groups.expenses.settlementTargets.useQuery(
    { groupId, debtorId: debtorId ?? '', creditorId: creditorId ?? '' },
    { enabled },
  )

  const selectValue = value.expenseId ?? NONE_VALUE

  if (!enabled) {
    return null
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{t('label')}</label>
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (next === NONE_VALUE) {
            onChange({ expenseId: undefined, participantId: undefined })
          } else {
            onChange({ expenseId: next, participantId: debtorId })
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>{t('none')}</SelectItem>
          {(targets ?? []).map((target) => (
            <SelectItem key={target.expenseId} value={target.expenseId}>
              {target.kind === 'straight' ? t('straightLabel') : t('leaseLabel')}
              {' · '}
              {target.expenseTitle}
              {' · '}
              {formatCurrency(currency, target.amount, locale)}
            </SelectItem>
          ))}
          {targets && targets.length === 0 && (
            <SelectItem value="__noop__" disabled>
              {t('noTargets')}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: `TypeScript compilation completed`

- [ ] **Step 4: Commit**

```bash
git add src/components/settle-target-select.tsx messages/en-US.json
git commit -m "feat(ui): SettleTargetSelect component"
```

---

## Task 10: Wire the select into `expense-form.tsx` and pre-fill from URL

**Files:**
- Modify: `src/app/groups/[groupId]/expenses/expense-form.tsx`

- [ ] **Step 1: Pre-fill from `?settle=...&settleParticipant=...`**

Edit `src/app/groups/[groupId]/expenses/expense-form.tsx`. In the reimbursement branch of the default-values calculation (currently around lines 228–259), add to the returned object:

```typescript
          settlesExpenseId: searchParams.get('settle') ?? undefined,
          settlesParticipantId:
            searchParams.get('settleParticipant') ?? undefined,
```

Also add the same two keys (set to `undefined`) to the non-reimbursement branch and the edit-existing branch so React Hook Form has them in the initial values shape.

For the edit branch (around lines ~210–227), use:

```typescript
          settlesExpenseId: expense.settlesExpenseId ?? undefined,
          settlesParticipantId: expense.settlesParticipantId ?? undefined,
```

(Verify `expense.settlesExpenseId` is in scope — depends on the tRPC `expenses.get` shape; if not, add it to that procedure's select.)

- [ ] **Step 2: Render the select inside the reimbursement section of the form**

Search the file for `searchParams.get('reimbursement')` (around line 854) — that's the conditional block that hides certain fields for reimbursements. Find a sensible place to render the select (e.g., near the `paidBy` / `paidFor` controls, inside the `isReimbursement === true` branch). Add:

```typescript
{form.watch('isReimbursement') && (
  <SettleTargetSelect
    groupId={group.id}
    debtorId={form.watch('paidBy')}
    creditorId={form.watch('paidFor')?.[0]?.participant}
    currency={getCurrencyFromGroup(group)}
    value={{
      expenseId: form.watch('settlesExpenseId'),
      participantId: form.watch('settlesParticipantId'),
    }}
    onChange={({ expenseId, participantId }) => {
      form.setValue('settlesExpenseId', expenseId)
      form.setValue('settlesParticipantId', participantId)
    }}
  />
)}
```

Add the import at the top: `import { SettleTargetSelect } from '@/components/settle-target-select'`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: `TypeScript compilation completed`

- [ ] **Step 4: Manual verification**

Dev server: open the expenses tab → click "Reimburse" on a straight item → confirm the select renders, the targeted expense is pre-selected, submitting creates a settled state, and editing the resulting reimbursement preserves the value.

- [ ] **Step 5: Commit**

```bash
git add src/app/groups/[groupId]/expenses/expense-form.tsx
git commit -m "feat(ui): wire SettleTargetSelect into the expense form"
```

---

## Task 11: Append `&settle=...&settleParticipant=...` to all Reimburse links

**Files:**
- Modify: `src/app/groups/[groupId]/straight-balances-list.tsx`
- Modify: `src/app/groups/[groupId]/person-balance-view.tsx`
- Modify: `src/app/groups/[groupId]/lease-items-list.tsx`

- [ ] **Step 1: Update `straight-balances-list.tsx`**

Find the Reimburse `<Link>` href (search the file for `reimbursement=yes`). Append the two params:

```typescript
href={`/groups/${groupId}/expenses/create?reimbursement=yes&from=${item.from}&to=${item.to}&amount=${item.amount}&expenseName=${encodeURIComponent(item.expenseTitle)}&settle=${item.expenseId}&settleParticipant=${item.from}`}
```

- [ ] **Step 2: Update `person-balance-view.tsx`**

Two affected links: the `'straight'` branch (~line 194) and the `'lease-buyin'` branch (~line 208). For straight, append `&settle=${item.expenseId}&settleParticipant=${personId}`. For lease-buyin, append `&settle=${item.leaseExpenseId}&settleParticipant=${item.buyInParticipantId}`.

- [ ] **Step 3: Update `lease-items-list.tsx`**

Find the buy-in "Reimburse" link (search `createReimbursement` translation key). Append `&settle=${item.expenseId}&settleParticipant=${b.participantId}`.

(The buyback link does NOT get a settle param — buyback is out of scope per the plan header.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: `TypeScript compilation completed`

- [ ] **Step 5: Manual end-to-end verification**

Dev server. For each of: a straight item, a lease buy-in, click "Reimburse". Confirm:
1. The form opens with the settle target pre-selected.
2. Submitting the form marks the original as paid (the row shows struck-through in the balance tab and disappears from the per-person view).
3. The new reimbursement appears under the Reimbursement filter in the main expenses list.
4. The reimbursement does NOT appear as a line item or offset in the per-person normal pair-net breakdown.
5. Deleting the reimbursement restores the original's unpaid state.

- [ ] **Step 6: Commit**

```bash
git add src/app/groups/[groupId]/straight-balances-list.tsx src/app/groups/[groupId]/person-balance-view.tsx src/app/groups/[groupId]/lease-items-list.tsx
git commit -m "feat(ui): append settle params to Reimburse links"
```

---

## Task 12: Apply the migration to local + remote DBs

**Files:** none (operational)

- [ ] **Step 1: Apply locally**

Ensure local DB is running (`make db`). Then:

```bash
npx prisma migrate deploy
```

Expected: `1 migration found` / `Applying migration 20260603000000_add_reimbursement_settlement_link`.

- [ ] **Step 2: Apply remotely (if appropriate)**

If you want the schema live before the next Vercel deploy:

```bash
DATABASE_URL="<prod-or-staging-url>" npx prisma migrate deploy
```

Otherwise, the `postinstall` script in `package.json` will run `prisma migrate deploy` on next Vercel build — pushing the branch is sufficient.

- [ ] **Step 3: Final sanity check**

Reload the app pointing at the migrated DB. Repeat the end-to-end verification from Task 11 Step 5.

---

## Out of Scope (deferred)

- **Lease buyback settlement linking.** Buyback uses the global `leaseBuybackCompleted` boolean. Per-participant settlement would require a new `LeaseBuybackPayment` table mirroring `LeaseBuyInPayment`. Out of scope for v1; buyback Reimburse links continue to create plain reimbursements.
- **Multi-select.** Single-select only for v1 (one reimbursement settles one debt). If batch-settle becomes a recurring ask, replace `settlesExpenseId/settlesParticipantId` scalars with a `ReimbursementSettlement` join table.
- **Amount-mismatch warning.** No warning if the reimbursement amount differs from the targeted debt amount. The settle link is independent of the amount field for v1.
- **Integration test for `createExpense` side-effects.** Project has no existing prisma integration test infra; tasks rely on manual verification. If this codifies into a recurring pattern, set up a test database harness.
