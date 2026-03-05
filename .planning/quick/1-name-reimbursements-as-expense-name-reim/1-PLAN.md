---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/groups/[groupId]/straight-balances-list.tsx
  - src/app/groups/[groupId]/lease-items-list.tsx
  - src/app/groups/[groupId]/person-balance-view.tsx
  - src/app/groups/[groupId]/expenses/expense-form.tsx
autonomous: true
requirements: [QUICK-1]
must_haves:
  truths:
    - "Reimbursements created from straight balances are named '{expenseTitle} - reimbursement'"
    - "Reimbursements created from lease items are named '{itemName} - reimbursement'"
    - "Reimbursements created from normal (aggregated) balances keep the generic 'reimbursement' title since no single expense name exists"
  artifacts:
    - path: "src/app/groups/[groupId]/expenses/expense-form.tsx"
      provides: "Reads 'expenseName' query param and formats title as '{name} - reimbursement' when present"
    - path: "src/app/groups/[groupId]/straight-balances-list.tsx"
      provides: "Passes expenseTitle as 'expenseName' query param in reimbursement links"
    - path: "src/app/groups/[groupId]/lease-items-list.tsx"
      provides: "Passes itemName as 'expenseName' query param in reimbursement links"
    - path: "src/app/groups/[groupId]/person-balance-view.tsx"
      provides: "Passes expenseTitle/leaseItemName as 'expenseName' query param in reimbursement links"
  key_links:
    - from: "straight-balances-list.tsx, lease-items-list.tsx, person-balance-view.tsx"
      to: "expense-form.tsx"
      via: "URL query param 'expenseName'"
      pattern: "expenseName="
---

<objective>
Format reimbursement titles as "{expense name} - reimbursement" when creating reimbursements or marking expenses as paid.

Purpose: Make reimbursement expenses clearly identifiable by referencing the original expense or lease item name.
Output: Updated link hrefs to pass expense names, and updated expense form to use them in the title.
</objective>

<execution_context>
@/Users/chriskruki/.claude/get-shit-done/workflows/execute-plan.md
@/Users/chriskruki/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/app/groups/[groupId]/expenses/expense-form.tsx (lines 228-257 — reimbursement default values)
@src/app/groups/[groupId]/straight-balances-list.tsx (line 50 — reimbursement link)
@src/app/groups/[groupId]/lease-items-list.tsx (lines 133, 205 — reimbursement links)
@src/app/groups/[groupId]/person-balance-view.tsx (lines 134, 147, 161, 190 — reimbursement links)
@src/lib/balances.ts (Reimbursement, StraightBalanceItem, LeaseItem types)
@src/lib/person-balances.ts (PersonDebtItem type — has expenseTitle and leaseItemName fields)

<interfaces>
<!-- Key types the executor needs -->

From src/lib/balances.ts:
```typescript
export type Reimbursement = {
  from: Participant['id']
  to: Participant['id']
  amount: number
}  // NOTE: No expense name — aggregated balance

export type StraightBalanceItem = {
  expenseId: string
  expenseTitle: string  // <-- available for reimbursement naming
  from: string
  to: string
  amount: number
}

export type LeaseItem = {
  expenseId: string
  itemName: string  // <-- available for reimbursement naming
  // ...other fields
}
```

From src/lib/person-balances.ts:
```typescript
export type PersonDebtItem = {
  type: 'normal' | 'straight' | 'lease-buyin' | 'lease-buyback'
  amount: number
  expenseTitle?: string      // available for straight
  leaseItemName?: string     // available for lease-buyin/lease-buyback
  // ...other fields
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add expenseName query param to all reimbursement links</name>
  <files>
    src/app/groups/[groupId]/straight-balances-list.tsx
    src/app/groups/[groupId]/lease-items-list.tsx
    src/app/groups/[groupId]/person-balance-view.tsx
  </files>
  <action>
Add an `expenseName` query parameter to every reimbursement link href. The value must be URI-encoded via `encodeURIComponent()`.

**straight-balances-list.tsx** (1 link, line 50):
- Add `&expenseName=${encodeURIComponent(item.expenseTitle)}` to the href.

**lease-items-list.tsx** (2 links, lines 133 and 205):
- Line 133 (buy-in reimbursement): Add `&expenseName=${encodeURIComponent(item.itemName)}` to the href.
- Line 205 (buyback reimbursement): Add `&expenseName=${encodeURIComponent(item.itemName)}` to the href.

**person-balance-view.tsx** (4 links, lines 134, 147, 161, 190):
- Line 134 (type === 'normal'): No expenseName available for aggregated normal balances. Leave this link unchanged.
- Line 147 (type === 'straight'): Add `&expenseName=${encodeURIComponent(item.expenseTitle!)}` — expenseTitle is guaranteed present for straight items.
- Line 161 (type === 'lease-buyin'): Add `&expenseName=${encodeURIComponent(item.leaseItemName!)}` — leaseItemName is guaranteed present for lease items.
- Line 190 (type === 'lease-buyback'): Add `&expenseName=${encodeURIComponent(item.leaseItemName!)}` — leaseItemName is guaranteed present for lease items.

Do NOT change the reimbursement-list.tsx links — normal Reimbursement type has no expense name.
  </action>
  <verify>
    <automated>cd /Users/chriskruki/gitlab/spliit && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>All straight and lease reimbursement links include the expenseName query parameter. Normal reimbursement links are unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Use expenseName in expense form reimbursement title</name>
  <files>src/app/groups/[groupId]/expenses/expense-form.tsx</files>
  <action>
In expense-form.tsx, modify the reimbursement default values block (around line 228-257). Currently line 230 sets `title: t('reimbursement')`.

Change the title logic to:
```typescript
title: searchParams.get('expenseName')
  ? `${searchParams.get('expenseName')} - ${t('reimbursement')}`
  : t('reimbursement'),
```

This produces:
- With expenseName param: "Groceries - reimbursement" (using the translated "reimbursement" string)
- Without expenseName param (normal balances): "reimbursement" (unchanged behavior)

The `searchParams.get('expenseName')` automatically handles URL decoding.
  </action>
  <verify>
    <automated>cd /Users/chriskruki/gitlab/spliit && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Expense form sets reimbursement title to "{expense name} - reimbursement" when expenseName query param is present, falls back to generic "reimbursement" when absent.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors: `npx tsc --noEmit`
2. Manual check: Navigate to balances page, click "Mark as paid" on a straight balance item, verify the expense form title is pre-filled as "{expense title} - reimbursement"
3. Manual check: Click "Create reimbursement" on a lease item, verify title is "{item name} - reimbursement"
4. Manual check: Click "Mark as paid" on a normal reimbursement (aggregated), verify title remains the generic "reimbursement"
</verification>

<success_criteria>
- Reimbursements from straight balances are named "{expenseTitle} - reimbursement"
- Reimbursements from lease items are named "{itemName} - reimbursement"
- Normal aggregated reimbursements keep the generic "reimbursement" title
- No TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/1-name-reimbursements-as-expense-name-reim/1-SUMMARY.md`
</output>
