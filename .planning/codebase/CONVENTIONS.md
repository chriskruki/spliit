# Coding Conventions

**Analysis Date:** 2026-02-24

## Naming Patterns

**Files:**
- React components: PascalCase (e.g., `async-button.tsx`, `BalancesList.tsx`, `RecentGroupListCard.tsx`)
- TypeScript utility/library files: camelCase or PascalCase (e.g., `utils.ts`, `balances.ts`, `api.ts`)
- Server action files: kebab-case with descriptive suffixes (e.g., `create-from-receipt-button-actions.ts`, `expense-list-fetch-action.ts`, `create-expense-form.tsx`)
- Procedure files: kebab-case with `.procedure.ts` suffix (e.g., `create.procedure.ts`, `list.procedure.ts`, `get.procedure.ts`)
- Test files: Same name as source with `.test.ts` suffix (e.g., `utils.test.ts`, `balances.test.ts`)

**Functions:**
- camelCase for all function names: `getBalances()`, `formatCurrency()`, `createGroup()`, `useMediaQuery()`
- Prefix hooks with `use`: `useMediaQuery()`, `useBaseUrl()`, `useActiveUser()`, `useCurrencyRate()`
- Prefix async operations with verbs: `createExpense()`, `deleteRecentGroup()`, `archiveGroup()`

**Variables:**
- camelCase: `maxBalance`, `locale`, `isLoading`, `activeUser`, `groupDetail`, `paidForIds`
- Boolean variables prefixed with `is`, `has`, or `should`: `isStarred`, `isArchived`, `isLoading`, `shouldRetryOnError`
- Constants in UPPER_SNAKE_CASE only for truly global constants (rare in this codebase)

**Types:**
- PascalCase for types, interfaces, and exported types: `Balances`, `Props`, `Currency`, `GroupFormValues`, `SettlementBalances`, `StraightBalanceItem`, `LeaseItem`, `Reimbursement`
- Generic type parameters: Single capital letters or descriptive names: `T`, `K`, `P` for generics; `MockExpense`, `SubItemInput`
- Suffix props objects with `Props`: `type Props = { ... }`

## Code Style

**Formatting:**
- Tool: Prettier v3.0.3
- Semi-colons: Disabled (`"semi": false`)
- Quotes: Single quotes (`"singleQuote": true`)
- Plugin: `prettier-plugin-organize-imports` - automatically organizes and groups imports

**Linting:**
- Tool: ESLint v9.39.1
- Config: Extends `next/core-web-vitals` (Next.js 16 recommended rules)
- ESLint config file: `.eslintrc.json`

**Commands:**
- Lint: `npm run lint`
- Format check: `npm run check-formatting`
- Format fix: `npm run prettier`
- Type checking: `npm run check-types`

## Import Organization

**Order (enforced by prettier-plugin-organize-imports):**
1. Node.js built-ins (e.g., `import { cache } from 'react'`)
2. External packages (e.g., `import { Prisma } from '@prisma/client'`, `import { z } from 'zod'`)
3. Relative imports and internal packages (e.g., `import { getBalances } from '@/lib/balances'`)

**Path Aliases:**
- `@/` maps to `/src/`
- Used consistently throughout: `@/lib/api`, `@/components/ui/button`, `@/trpc/routers/_app`

**Barrel Files:**
- Used in `/src/trpc/routers/` for aggregating procedures (e.g., `src/trpc/routers/groups/index.ts` imports all group procedures)
- No barrel files found in `/src/components/` - components are imported directly

## Error Handling

**Patterns:**
- Throw descriptive `Error` objects with context: `throw new Error(\`Invalid group ID: ${groupId}\`)` (seen in `api.ts:42`, `api.ts:49`)
- Try-catch blocks for async operations: Used in hooks, components, and server actions to handle failures
- Error logging: `console.error(err)` in catch blocks (e.g., `async-button.tsx:25`)
- No global error handler detected - errors caught at point of use

**Examples from codebase:**
```typescript
// api.ts - Direct validation throws
if (!group) throw new Error(`Invalid group ID: ${groupId}`)

// async-button.tsx - Catch and suppress with logging
try {
  setLoading(true)
  await action?.()
} catch (err) {
  console.error(err)
} finally {
  setLoading(false)
}

// hooks.ts - Fetch error handling
if (!res.ok) throw new TypeError('Unsuccessful response from API', { cause: res })
```

## Logging

**Framework:** console (no dedicated logging library)

**Patterns:**
- `console.error(err)` for error logging (e.g., `async-button.tsx:25`)
- No explicit debug logging found throughout codebase
- Prefer console methods over third-party loggers

## Comments

**When to Comment:**
- JSDoc/TSDoc for public API functions: Functions exported for use by other modules should have documentation comments
- Inline comments for complex logic: Recurrence calculations, data transformations, timezone handling
- Comments for non-obvious behavior: "Prevents SSR issues" (hooks.ts:7), timezone shift explanations in date formatting (utils.ts:28-36)

**JSDoc/TSDoc Pattern:**
Used extensively for functions with complex parameters or side effects:
```typescript
/**
 * Formats a date-only field (without time) for display.
 * Extracts UTC date components to avoid timezone shifts that can cause off-by-one day errors.
 * Use this for dates stored as DATE type in the database (e.g., expenseDate).
 *
 * @param date - The date to format (typically from a database DATE field, e.g., 2025-10-17T00:00:00.000Z)
 * @param locale - The locale string (e.g., 'en-US', 'fr-FR')
 * @param options - Formatting options (dateStyle, timeStyle)
 * @returns Formatted date string in the specified locale
 */
export function formatDateOnly(date: Date, locale: string, options?: {}) { ... }
```

**Inline comments:**
- Used for algorithm explanations (e.g., balance calculations in `balances.test.ts`)
- Recurrence rule limitations documented in comments (e.g., `api.ts:736-741`)

## Function Design

**Size:** Functions kept concise, typically under 30 lines. Larger functions (e.g., `createExpense` in `api.ts`) are broken into logical sections with comment separators

**Parameters:**
- Use object destructuring for multiple parameters: `createExpense(expenseFormValues: ExpenseFormValues, groupId: string, participantId?: string)`
- Optional parameters marked with `?`: Seen in hooks (`useActiveUser(groupId?: string)`)

**Return Values:**
- Consistent return types: Functions either return `T`, `Promise<T>`, or `T | null`
- Nullable returns are explicit: `useBaseUrl()` returns `string | null` until DOM is ready
- No implicit `undefined` returns - functions either return a value or throw

## Module Design

**Exports:**
- Named exports preferred: `export function getBalances()`, `export const groupFormSchema = z.object(...)`
- Default exports used rarely (not found in examined files)

**Barrel Files:**
- Used at `/src/trpc/routers/*/index.ts` to export and aggregate related procedures
- Pattern: Re-export procedures from specific files and combine into a router object
- Example (`src/trpc/routers/groups/index.ts`):
```typescript
export const groupsRouter = createTRPCRouter({
  expenses: groupExpensesRouter,
  balances: groupBalancesRouter,
  // ...
})
```

## Special Patterns

**Zod Schemas:**
- Defined in `src/lib/schemas.ts`
- Use `z.object()`, `z.array()`, `z.union()` for validation
- Custom refinements with `.superRefine()` for cross-field validation
- Type inference with `z.infer<typeof schema>`: `export type GroupFormValues = z.infer<typeof groupFormSchema>`

**ts-pattern Match:**
- Used for exhaustive pattern matching in `balances.ts:70-76`:
```typescript
const [shares, totalShares] = match(splitMode)
  .with('EVENLY', () => [1, paidFors.length])
  .with('BY_SHARES', () => [paidFor.shares, totalPaidForShares])
  .otherwise(() => [1, paidFors.length])
```

**React Components:**
- Use `'use client'` directive for client-side components (e.g., `async-button.tsx:1`)
- Props defined as `type Props = { ... }` and destructured in function signature
- Hooks (useState, useEffect) used for state management, no class components

---

*Convention analysis: 2026-02-24*
