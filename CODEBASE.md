# Codebase Reference

> **Maintenance rule:** Update this file when adding models, routes, procedures, settlement logic, or UI sections. Keep entries terse — file:line pointers over code snippets.

## Stack

Next.js 16 (App Router) | React 19 | TypeScript | TailwindCSS + shadcn/ui (Radix) | tRPC 11 | Prisma 6 + PostgreSQL | next-intl (24 locales) | Zod | React Hook Form | Jest

## Directory Layout

```
prisma/schema.prisma          — DB models & enums
messages/{locale}.json         — i18n strings (en-US is source of truth)
src/
  app/                         — Next.js pages (App Router)
    groups/[groupId]/
      expenses/                — CRUD pages + expense-form.tsx
      balances/                — balances-and-reimbursements.tsx (main view)
      balances-list.tsx        — Normal mode balances
      straight-balances-list.tsx — Straight mode list
      lease-items-list.tsx     — Lease cards (buy-in + buyback)
      reimbursement-list.tsx   — Suggested reimbursements
      grand-total-summary.tsx  — Summary card (totalOwed)
      stats/ activity/ information/ edit/
    api/trpc/[trpc]/route.ts   — tRPC HTTP handler
  trpc/
    init.ts                    — tRPC base procedure + SuperJSON
    client.tsx                 — React Query provider
    routers/_app.ts            — Root router
    routers/groups/
      expenses/index.ts        — Expense router (list|get|create|update|delete|toggleLeaseBuyback|toggleLeaseBuyIn)
      balances/list.procedure.ts — Calls getSettlementBalances()
  lib/
    api.ts                     — DB operations (createExpense, updateExpense, getGroupExpenses, etc.)
    balances.ts                — Balance engine (getBalances, getSettlementBalances, getSuggestedReimbursements, getLeaseItems, getStraightBalanceItems)
    schemas.ts                 — Zod schemas (groupFormSchema, expenseFormSchema)
    prisma.ts                  — Prisma singleton
    utils.ts                   — formatCurrency, formatDateOnly, cn
    currency.ts / locale.ts / hooks.ts / totals.ts
  components/ui/               — shadcn primitives (Button, Card, Dialog, etc.)
  components/                  — App components (group-form, category-selector, etc.)
  i18n/request.ts              — Locale config + deepmerge fallback
```

## Database Models (prisma/schema.prisma)

| Model | PK | Key Fields | Relations |
|-------|----|-----------|-----------|
| Group | id | name, currency, currencyCode | → Participant[], Expense[], Activity[] |
| Participant | id | name, groupId | → Expense[] (paidBy), ExpensePaidFor[], Expense[] (leaseOwner), SubItemPaidFor[], LeaseBuyInPayment[] |
| Expense | id | amount (cents), title, expenseDate, splitMode, settlementMode, paidById, leaseOwnerId?, leaseBuybackDate?, leaseBuybackCompleted, leaseItemName? | → ExpensePaidFor[], ExpenseSubItem[], ExpenseDocument[], LeaseBuyInPayment[], RecurringExpenseLink? |
| ExpensePaidFor | (expenseId, participantId) | shares | |
| ExpenseSubItem | id | title, amount, splitMode, expenseId | → SubItemPaidFor[] |
| SubItemPaidFor | (subItemId, participantId) | shares | |
| LeaseBuyInPayment | (expenseId, participantId) | — | Tracks per-participant buy-in paid status |
| ExpenseDocument | id | url, width, height, expenseId | |
| Category | id (int) | grouping, name | |
| Activity | id | groupId, activityType, time | |
| RecurringExpenseLink | id | groupId, currentFrameExpenseId, nextExpenseDate | |

**Enums:** SplitMode (EVENLY|BY_SHARES|BY_PERCENTAGE|BY_AMOUNT), SettlementMode (NORMAL|STRAIGHT|LEASE), RecurrenceRule (NONE|DAILY|WEEKLY|MONTHLY), ActivityType (UPDATE_GROUP|CREATE_EXPENSE|UPDATE_EXPENSE|DELETE_EXPENSE)

## Settlement Modes — Core Logic (src/lib/balances.ts)

`getSettlementBalances(expenses)` splits expenses by `settlementMode`, then:

| Mode | Calculator | Output Type | Totals |
|------|-----------|-------------|--------|
| NORMAL | `getBalances()` → `getSuggestedReimbursements()` | `{ balances, reimbursements, publicBalances }` | reimbursement amounts |
| STRAIGHT | `getStraightBalanceItems()` | `StraightBalanceItem[]` { expenseId, from, to, amount } | item amounts |
| LEASE | `getLeaseItems()` | `LeaseItem[]` { expenseId, itemName, totalCost, ownerId, buybackDate, buybackCompleted, buybackBreakdown[], buyInBreakdown[] } | unpaid buy-in + pending buyback amounts |

**Amount distribution:** `distributeAmount(amount, splitMode, paidFors)` handles all split modes. `computeParticipantShares(expense)` accounts for sub-items (each with own split) + remainder on parent split.

**Lease breakdown logic:**
- `buybackBreakdown`: participants (excl. owner) × their share — what owner owes them at buyback
- `buyInBreakdown`: participants (excl. purchaser/paidBy) × their share — what they owe purchaser upfront; `paid` checked via `LeaseBuyInPayment` records

## tRPC Procedures

```
groups.expenses.list          — getGroupExpenses(groupId, { offset, length, filter, settlementMode })
groups.expenses.get           — getExpense(groupId, expenseId)
groups.expenses.create        — createExpense(formValues, groupId)
groups.expenses.update        — updateExpense(groupId, expenseId, formValues)
groups.expenses.delete        — deleteExpense(groupId, expenseId)
groups.expenses.toggleLeaseBuyback — toggles expense.leaseBuybackCompleted
groups.expenses.toggleLeaseBuyIn   — upsert/delete LeaseBuyInPayment(expenseId, participantId)
groups.balances.list          — getSettlementBalances(expenses) → { balances, reimbursements, straight, lease, totals }
groups.activities.list        — getActivities(groupId)
groups.stats.get              — group statistics
categories.list               — all categories
```

## Data Flow: getGroupExpenses → Balances

`getGroupExpenses()` (src/lib/api.ts:447) uses `prisma.expense.findMany` with select:
- Core fields + `paidBy{id,name}` + `paidFor[]{participant{id,name}, shares}` + `splitMode` + `settlementMode`
- Lease fields: `leaseOwnerId`, `leaseBuybackDate`, `leaseBuybackCompleted`, `leaseItemName`, `leaseOwner{id,name}`
- Sub-items: `subItems[]{id, title, amount, splitMode, paidFor[]}`
- Buy-in: `leaseBuyInPayments[]{participantId}`

This return type is aliased as `GroupExpenses` in balances.ts and consumed by all balance calculators.

## Balances Page Components

`balances-and-reimbursements.tsx` fetches `trpc.groups.balances.list` and renders:
1. `GrandTotalSummary` — totals card
2. Normal section → `BalancesList` + `ReimbursementList`
3. Straight section → `StraightBalancesList`
4. Lease section → `LeaseItemsList`

Each section is collapsible with colored left border (green/blue/amber).

## i18n Keys (messages/en-US.json)

Relevant sections: `Expenses.*`, `ExpenseForm.*` (incl. `SettlementMode.*`, `LeaseFields.*`, `SubItems.*`), `Balances.*` (incl. `Normal.*`, `Straight.*`, `Lease.*`, `Reimbursements.*`, `GrandTotal.*`), `Stats.*`, `Activity.*`

New keys added under `Balances.Lease`: `buyInBreakdown`, `buyInFrom`, `buyInPaid`, `buyInUnpaid`, `toggleBuyInPaid`, `toggleBuyInUndo`

## Patterns to Follow

- **New tRPC procedure:** Create `src/trpc/routers/groups/{domain}/{name}.procedure.ts`, register in `index.ts`
- **New DB model:** Add to schema.prisma + reverse relations, run `npx prisma migrate dev --name <name>`
- **New balance type:** Add to `SettlementBalances`, compute in `getSettlementBalances()`, expose via `balances/list.procedure.ts`
- **New UI section:** Add component in `src/app/groups/[groupId]/`, wire into `balances-and-reimbursements.tsx`
- **Translations:** Add keys to `messages/en-US.json` first, use `useTranslations('Section.Key')` in components
- **Mutations with cache invalidation:** Call `utils.groups.balances.invalidate()` in `onSuccess`
- **Amounts:** Stored as integers (cents). Use `formatCurrency(currency, amount, locale)` for display.
- **IDs:** Generated via `nanoid()` (see `randomId()` in api.ts)
