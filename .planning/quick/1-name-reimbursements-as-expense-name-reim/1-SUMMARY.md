---
phase: quick
plan: 1
subsystem: ui
tags: [next.js, reimbursement, query-params, expense-form]

# Dependency graph
requires: []
provides:
  - "Reimbursement titles include originating expense/lease-item name"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pass context via URL query params between balance views and expense form"

key-files:
  created: []
  modified:
    - "src/app/groups/[groupId]/straight-balances-list.tsx"
    - "src/app/groups/[groupId]/lease-items-list.tsx"
    - "src/app/groups/[groupId]/person-balance-view.tsx"
    - "src/app/groups/[groupId]/expenses/expense-form.tsx"

key-decisions:
  - "Use encodeURIComponent for expense names in URLs to handle special characters"
  - "Normal aggregated reimbursements keep generic title since no single expense name exists"

patterns-established:
  - "expenseName query param pattern: balance views pass context to expense form via URL"

requirements-completed: [QUICK-1]

# Metrics
duration: 1min
completed: 2026-03-05
---

# Quick Task 1: Name Reimbursements as Expense Name Summary

**Reimbursement titles now display as "{expense name} - reimbursement" via expenseName query param from balance views to expense form**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-05T04:53:07Z
- **Completed:** 2026-03-05T04:53:59Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- All straight balance and lease item reimbursement links pass the expense/item name as a query parameter
- Expense form reads the expenseName param and formats the title as "{name} - reimbursement"
- Normal aggregated reimbursements retain the generic "reimbursement" title (no name available)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add expenseName query param to all reimbursement links** - `09ad66c` (feat)
2. **Task 2: Use expenseName in expense form reimbursement title** - `32ffba8` (feat)

## Files Created/Modified
- `src/app/groups/[groupId]/straight-balances-list.tsx` - Added expenseName param with item.expenseTitle
- `src/app/groups/[groupId]/lease-items-list.tsx` - Added expenseName param with item.itemName on both buy-in and buyback links
- `src/app/groups/[groupId]/person-balance-view.tsx` - Added expenseName param on straight and lease links, left normal unchanged
- `src/app/groups/[groupId]/expenses/expense-form.tsx` - Reads expenseName param to format reimbursement title

## Decisions Made
- Used encodeURIComponent for expense names to safely handle special characters in URLs
- Normal aggregated reimbursements keep generic title since no single expense name exists for aggregated balances

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

---
*Quick Task: 1-name-reimbursements-as-expense-name-reim*
*Completed: 2026-03-05*
