---
phase: quick
plan: 260413-g1d
subsystem: balances-ui
tags: [balances, normal-mode, expense-list, ui]
key-files:
  created:
    - src/app/groups/[groupId]/normal-expenses-list.tsx
  modified:
    - src/trpc/routers/groups/balances/list.procedure.ts
    - src/app/groups/[groupId]/balances/balances-and-reimbursements.tsx
    - messages/en-US.json
decisions:
  - Expose normalExpenses from balances tRPC endpoint rather than making a separate query, keeping data co-located
  - Link each expense to its edit page for quick access
metrics:
  duration: "~15 minutes"
  completed: "2026-04-13"
  tasks: 1
  files: 4
---

# Quick Task 260413-g1d: List Expense Details Under Normal Balance

**One-liner:** Added per-expense breakdown list under normal balances section, showing each expense title, payer, and amount with a link to the expense edit page.

## What Was Done

The normal balance section previously showed only aggregate participant bars (BalancesList) and suggested reimbursements (ReimbursementList). There was no way to see which individual expenses contributed to the balances without switching to the Expenses tab.

### Changes Made

**`src/trpc/routers/groups/balances/list.procedure.ts`**
- Added `normalExpenses` to the balances query response
- Filters expenses to only `settlementMode === 'NORMAL'` (or null, which defaults to NORMAL)
- Returns `id`, `title`, `amount`, `expenseDate`, `paidById`, `paidByName` per expense

**`src/app/groups/[groupId]/normal-expenses-list.tsx`** (new)
- New `NormalExpensesList` component
- Renders each normal expense as a row with title, "Paid by {name}", and amount
- Each row is a link to the expense edit page
- Shows "No normal expenses yet." when empty
- Uses `formatCurrency` and `useLocale` for consistent currency display

**`src/app/groups/[groupId]/balances/balances-and-reimbursements.tsx`**
- Imports `NormalExpensesList`
- Inserts "Expenses" subsection between the balance bars and suggested reimbursements
- Maps tRPC response dates via `new Date()` for proper Date objects

**`messages/en-US.json`**
- Added `Normal.expensesTitle`, `Normal.noExpenses`, `Normal.paidBy` strings

## Deviations from Plan

None - this was an exploratory implementation with no prior plan file.

## Self-Check: PASSED

- `src/app/groups/[groupId]/normal-expenses-list.tsx` - FOUND
- Commit `997d2e8` - FOUND (`git log --oneline -1`)
- TypeScript: no errors (`npx tsc --noEmit` clean)
