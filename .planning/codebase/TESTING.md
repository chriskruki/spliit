# Testing Patterns

**Analysis Date:** 2026-02-24

## Test Framework

**Runner:**
- Jest v29.7.0
- Config: `jest.config.ts`
- Environment: jsdom (browser-like environment for component testing)
- Coverage provider: v8

**Assertion Library:**
- Jest built-in matchers (expect API)

**Run Commands:**
```bash
npm run test                      # Run all tests
npm run test -- --watch          # Watch mode
npm run test -- --coverage       # Coverage report
```

## Test File Organization

**Location:**
- Tests are co-located with source files in the same directory
- Test files sit alongside their implementation

**Naming:**
- Pattern: `{filename}.test.ts` or `{filename}.test.tsx`
- Examples: `utils.test.ts`, `balances.test.ts`

**Structure:**
```
src/lib/
├── utils.ts
├── utils.test.ts          # Test file for utils
├── balances.ts
└── balances.test.ts       # Test file for balances
```

## Test Structure

**Suite Organization:**
Tests use Jest's `describe()` and `it()` blocks with clear naming:

```typescript
describe('getBalances - existing behavior preserved', () => {
  it('computes even split between 2 participants', () => {
    // test body
  })
})

describe('straight mode - per-expense line items', () => {
  it('creates one line item per non-payer participant', () => {
    // test body
  })
})
```

**Patterns:**
- Setup: Helper functions (`makeExpense()`, `makeSubItem()`) create test data
- Assertions: Direct property checks: `expect(balances['A'].total).toBe(500)`
- Teardown: No explicit teardown found - tests are independent

## Test Data Factories

**Factories:**
Test helpers at top of test file for building complex objects:

```typescript
type SubItemInput = {
  title?: string
  amount: number
  splitMode?: string
  paidForIds: string[]
  shares?: number[]
}

function makeSubItem(input: SubItemInput) {
  const { title = 'Sub-item', amount, splitMode = 'EVENLY', paidForIds, shares } = input
  return {
    id: `sub-${Math.random().toString(36).slice(2)}`,
    title,
    amount,
    splitMode,
    paidFor: paidForIds.map((pid, i) => ({
      participant: { id: pid, name: pid },
      shares: shares ? shares[i] : 1,
    })),
  }
}

function makeExpense(overrides: Omit<Partial<MockExpense>, 'subItems'> & {...}): MockExpense {
  const { id = 'exp1', title = 'Test', amount, paidById, paidForIds, subItems: subItemInputs, ...rest } = overrides
  return {
    id,
    title,
    amount,
    splitMode: 'EVENLY',
    settlementMode: 'NORMAL',
    isReimbursement: false,
    // ... rest of default expense
  }
}
```

**Location:**
- Defined in test files themselves (not in separate fixture files)
- Reused across multiple test cases within a single file

**Purpose:**
- Reduce duplication of complex test data
- Make tests readable by allowing focused test setup: `makeExpense({ amount: 1000, paidById: 'A', paidForIds: ['A', 'B'] })`

## Test Types

**Unit Tests:**
- Scope: Pure functions and business logic
- Approach: Test single functions with various inputs and verify outputs
- Example: `balances.test.ts` tests balance calculation functions with different expense configurations
- No mocking of dependencies - tests call real implementations

**Integration Tests:**
- Not found in codebase as separate category
- Some tests verify interaction between functions: `getSettlementBalances()` with various `settlementMode` values

**E2E Tests:**
- Not detected in codebase
- No Cypress, Playwright, or similar tools configured

## Coverage

**Requirements:** Not enforced (no coverage thresholds in jest.config.ts)

**Current State:**
- Only 2 test files found: `utils.test.ts` and `balances.test.ts`
- Large portions of codebase untested (no tests for components, server actions, or API routes)

**View Coverage:**
```bash
npm run test -- --coverage
```

## Common Patterns

**Parametrized Testing:**
Tests use loops to validate multiple variations with common setup:

```typescript
const variations: variation[] = [
  { amount: partialAmount, locale: 'en-US', result: `${currency.symbol}1.23` },
  { amount: smallAmount, locale: 'en-US', result: `${currency.symbol}1.00` },
  { amount: largeAmount, locale: 'en-US', result: `${currency.symbol}10,000.00` },
]

for (const variation of variations) {
  it(`formats ${variation.amount} in ${variation.locale} without fractions`, () => {
    expect(formatCurrency(currency, variation.amount * 100, variation.locale)).toBe(variation.result)
  })
  it(`formats ${variation.amount} in ${variation.locale} with fractions`, () => {
    expect(formatCurrency(currency, variation.amount, variation.locale, true)).toBe(variation.result)
  })
}
```

**Numeric Tolerance:**
Tests account for floating-point rounding errors:

```typescript
// balances.test.ts - allows ±1 cent tolerance
const totalBalance = balances['A'].total + balances['B'].total + balances['C'].total
expect(Math.abs(totalBalance)).toBeLessThanOrEqual(1)
```

**Nested Object Matching:**
Tests use `toMatchObject()` for partial assertions:

```typescript
expect(result.straight[0]).toMatchObject({
  from: 'B',
  to: 'A',
  amount: 1000,
})
```

**Test Isolation:**
- Factory functions generate unique IDs: ``id: `sub-${Math.random().toString(36).slice(2)}`
- Tests are completely independent - no shared state between tests

## Assertion Patterns

**Equality checks:**
```typescript
expect(balances['A'].total).toBe(500)
```

**Array length:**
```typescript
expect(reimbursements).toHaveLength(1)
expect(result.straight).toHaveLength(2)
```

**Array contents:**
```typescript
expect(reimbursements[0]).toEqual({ from: 'B', to: 'A', amount: 500 })
```

**Deeply nested matching:**
```typescript
expect(lease.buybackBreakdown).toHaveLength(3)
for (const b of lease.buybackBreakdown) {
  expect(b.amount).toBe(1000)
}
```

## What IS Tested

**`src/lib/utils.test.ts` - 12 test cases:**
- `formatCurrency()` with different locales and amounts
- Covers edge cases: decimals, small amounts, large amounts
- Tests both fraction and non-fraction modes
- Validates locale-specific formatting (en-US vs de-DE)

**`src/lib/balances.test.ts` - 20+ test cases:**
- `getBalances()` basic operation and multiple expenses
- `getSuggestedReimbursements()` payment suggestions
- `getSettlementBalances()` with NORMAL, STRAIGHT, and LEASE settlement modes
- Sub-item calculations with EVENLY, BY_AMOUNT, BY_PERCENTAGE split modes
- Mixed settlement modes in single expense list
- Backward compatibility (missing settlementMode field)

## What IS NOT Tested

**No tests found for:**
- React components (`src/app/`, `src/components/`)
- Server actions and mutations
- API routes (`src/app/api/`)
- tRPC procedures (`src/trpc/routers/`)
- Hooks (`useMediaQuery`, `useCurrencyRate`, etc.)
- Authentication flows
- Form validation beyond schema parsing
- Error cases beyond explicit throws

## Test Setup Configuration

**Config file: `jest.config.ts`**
```typescript
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],  // Commented out, not in use
}
```

**No setup file:**
- `jest.setup.ts` is commented out - no global test setup
- Each test file is self-contained with its own helpers

**No testing libraries configured:**
- `@testing-library/react` v16.3.0 is installed but not used in examined tests
- `@testing-library/jest-dom` v6.4.8 is installed but not used
- Suggests infrastructure is ready for component testing but not yet implemented

## Running Tests

**All tests:**
```bash
npm run test
```

**Watch mode:**
```bash
npm run test -- --watch
```

**Single file:**
```bash
npm run test -- src/lib/balances.test.ts
```

**Coverage:**
```bash
npm run test -- --coverage
```

---

*Testing analysis: 2026-02-24*
