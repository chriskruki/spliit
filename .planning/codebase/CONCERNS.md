# Codebase Concerns

**Analysis Date:** 2026-02-24

## Tech Debt

**Excessive `as any` Type Assertions:**
- Issue: Heavy use of `as any` to bypass TypeScript strict mode, particularly in form field handling and type coercion
- Files: `src/app/groups/[groupId]/expenses/expense-form.tsx` (18+ instances)
- Impact: Reduces type safety, makes refactoring difficult, masks underlying schema mismatches between form state and data models
- Fix approach: Refactor form types to properly handle string/number coercion at schema boundary rather than within component logic. Create explicit type converters for shares (string ↔ number).

**Recurrence Rule Library Limitation:**
- Issue: Custom `calculateNextDate()` function has hardcoded limitations for month-end dates (29th, 30th, 31st)
- Files: `src/lib/api.ts:736-768` (calculateNextDate, isDateInNextMonth)
- Impact: Recurring monthly expenses fail to maintain day-of-month consistency (Jan 31 → Feb 28 → Mar 28, etc.). This is documented in comments but unfixed.
- Fix approach: Replace with `rrule` library (https://github.com/jkbrzt/rrule) as noted in TODO comment. This will properly handle month-end edge cases and provide RFC 5545 compliance.

**Locale-Based Currency Default Not Implemented:**
- Issue: Default currency code hardcoded to 'USD', ignoring user locale
- Files: `src/components/group-form.tsx:76`
- Impact: Non-US users must manually select currency for every new group; poor UX for international audiences
- Fix approach: Use locale from `useLocale()` to determine default currency via a locale→currency mapping table. Add this to currency.ts.

**Unsafe localStorage Usage Without Error Boundaries:**
- Issue: Multiple `JSON.parse()` calls on localStorage without try-catch; if data is corrupted, entire feature fails silently
- Files: `src/app/groups/recent-groups-helpers.ts:23, 48, 73`
- Impact: Corrupted localStorage (e.g., quota exceeded, partial write) causes silent data loss with no user feedback
- Fix approach: Wrap all `JSON.parse()` calls in try-catch; use Zod validation after parse (already done in safeParse, but missing catch handler). Add user notification for parse failures.

**Weak Random ID Generation in Tests:**
- Issue: Test fixture uses `Math.random().toString(36).slice(2)` for generating sub-item IDs
- Files: `src/lib/balances.test.ts:21`
- Impact: Low collision risk in tests specifically (acceptable), but pattern could be copied to production; nanoid should be used elsewhere
- Fix approach: Replace with nanoid() in test fixtures for consistency with production code (via randomId()).

---

## Known Issues

**Incomplete Sub-item Functionality:**
- Symptoms: Sub-items feature added to schema but not fully integrated into balance calculations for all settlement modes
- Files: `src/lib/balances.ts`, `src/app/groups/[groupId]/expenses/expense-form.tsx`, `prisma/schema.prisma`
- Trigger: Creating expense with sub-items; calculating balances; switching settlement modes with sub-items
- Impact: Sub-items may not distribute correctly across all settlement modes (NORMAL/STRAIGHT/LEASE)
- Workaround: Test thoroughly before relying on sub-items in production groups

**Unhandled Error Cases in API Layer:**
- Symptoms: Errors thrown as plain Error objects with string messages; no structured error types
- Files: `src/lib/api.ts` (multiple throw statements on lines 42, 49, 120, etc.)
- Impact: Client code cannot distinguish between validation errors, auth errors, and server errors; error messages not localized
- Fix approach: Create TRPCError-based error response; migrate from generic Error throws to TRPC-specific error handling

---

## Security Considerations

**localStorage Accessed Without SSR Guard in Form Components:**
- Risk: localStorage doesn't exist in server context; component may hydration mismatch if default values read during SSR
- Files: `src/app/groups/[groupId]/expenses/expense-form.tsx:89-96` (does check `typeof localStorage !== 'undefined'`), but also `src/components/group-form.tsx:95` (no guard visible)
- Current mitigation: Some guard clauses present, but inconsistently applied
- Recommendations: Audit all localStorage usage; wrap in useEffect with 'use client' directive; or move to client-side-only helper. Use consistent pattern across all components.

**JSON.parse Without Validation on User-Controlled Data:**
- Risk: Malicious or corrupted JSON in localStorage could cause runtime errors or unexpected behavior
- Files: `src/app/groups/recent-groups-helpers.ts:23, 48, 73`
- Current mitigation: Zod safeParse() validates structure after parse, returns empty array on failure
- Recommendations: Add explicit try-catch around JSON.parse; log validation failures for monitoring; consider quota exceeded handling

**No CSRF Protection for Form Submissions:**
- Risk: tRPC mutations lack explicit CSRF tokens; relying on same-site SameSite cookie
- Files: Expense/Group forms → tRPC mutations (src/trpc/routers/groups/*)
- Current mitigation: SameSite=Strict inferred from Next.js defaults (verify in middleware)
- Recommendations: Verify SameSite cookie policy in next.config.mjs or middleware; consider token-based CSRF if supporting cross-site scenarios

**AI Receipt Parsing Input Not Sanitized:**
- Risk: Receipt text/images sent to OpenAI API may contain sensitive PII
- Files: `src/app/groups/[groupId]/expenses/create-from-receipt-button.tsx`
- Current mitigation: Character limit enforced (src/components/expense-form-actions.tsx:10 - CHAR_LIMIT)
- Recommendations: Add explicit PII scrubbing before sending to OpenAI; document data retention policy; add consent banner for API usage

---

## Performance Bottlenecks

**Large expense-form.tsx Component (1830 lines):**
- Problem: Single component handles complex form state, sub-items, settlement modes, dynamic field arrays
- Files: `src/app/groups/[groupId]/expenses/expense-form.tsx`
- Cause: No component extraction; form state mutations trigger full re-render of 1800+ lines
- Improvement path: Extract sub-components (SettlementModeSelector, SubItemsSection, SplittingOptions, etc.) into separate files; use React.memo() for stable sub-components; consider moving field array logic to custom hook

**Repeated Zod Validation on Every Form Change:**
- Problem: React Hook Form may validate entire schema on every keystroke
- Files: `src/lib/schemas.ts` (expenseFormSchema is complex with nested arrays)
- Cause: No explicit mode: 'onBlur' optimization visible in form initialization
- Improvement path: Add `mode: 'onBlur'` to useForm() config for expensive schemas; validate sub-items separately

**Missing Pagination/Virtualization in Expense Lists:**
- Problem: All expenses loaded into memory; expense-list.tsx renders full list
- Files: `src/app/groups/[groupId]/expenses/expense-list.tsx`
- Cause: No cursor-based pagination or virtual list (react-window); getGroupExpenses() fetches full history
- Improvement path: Implement cursor-based pagination with offset/limit; use IntersectionObserver for lazy loading; or integrate react-virtual for 1000+ expense groups

**Recalculating Balances on Every Page Load:**
- Problem: getSettlementBalances() runs full computation for every balance query
- Files: `src/lib/balances.ts`, `src/trpc/routers/groups/balances/list.procedure.ts`
- Cause: No caching layer; expensive for large groups with thousands of expenses
- Improvement path: Implement incremental balance updates in database (denormalized balance table updated on expense mutation); cache results in Redis keyed by groupId + expense count hash

---

## Fragile Areas

**Balance Engine Logic:**
- Files: `src/lib/balances.ts`, `src/lib/balances.test.ts`
- Why fragile: Complex branching logic across NORMAL/STRAIGHT/LEASE settlement modes; sub-items add another dimension of splitting; any change to expense schema can break calculations
- Safe modification: Any change to balance calculations must include test updates (test file exists: 470 lines); consider parameterized tests for each settlement mode
- Test coverage: balances.test.ts covers getBalances, getSuggestedReimbursements, getSettlementBalances, getLeaseItems. New settlement modes require new test fixtures.

**Expense Form Type System:**
- Files: `src/app/groups/[groupId]/expenses/expense-form.tsx`, `src/lib/schemas.ts`
- Why fragile: Heavy type assertions (`as any`) mask schema mismatches; changing ExpenseFormValues schema requires updating 20+ cast sites
- Safe modification: Avoid adding new optional fields; if adding complex nested structures, refactor schema handling first to eliminate `as any`
- Test coverage: No unit tests for form validation; integration tests only

**Lease Feature (Recently Added):**
- Files: `src/lib/api.ts`, `src/lib/balances.ts`, expense-form.tsx (lease fields), `prisma/schema.prisma` (LEASE enum + leaseOwner* fields)
- Why fragile: New feature still stabilizing; lease buyback logic uses `leaseBuybackCompleted` flag; sub-items interact with lease splits in untested ways
- Safe modification: Lease buyback date calculation, buyback payment distribution, and buy-in payment tracking need thorough testing before extending
- Test coverage: Limited; balances.test.ts has minimal lease test scenarios

---

## Scaling Limits

**Database Query N+1 in getGroupExpenses:**
- Current capacity: Expenses table grows unbounded; no archival
- Limit: ~10k expenses per group becomes slow; N+1 queries if paidBy/paidFor not properly selected
- Files: `src/lib/api.ts:447-500` (getGroupExpenses)
- Scaling path: Verify Prisma select() includes all relations; add pagination; implement soft-delete for archived expenses; denormalize frequently-accessed aggregates (totalOwed, balances)

**PostgreSQL JSON Aggregation in Expense Queries:**
- Current capacity: Works for typical group sizes (2-20 participants)
- Limit: 10,000+ participants will cause JSON aggregation performance issues
- Scaling path: For massive groups, separate participant relationship into indexed table; cache computed payouts

**localStorage Quota (5-10MB):**
- Current capacity: Current localStorage usage for recent groups, starred groups, archived groups is minimal
- Limit: If storing full group snapshots locally, quota exhausted at ~1000 groups
- Scaling path: Move to IndexedDB for larger datasets; implement LRU cache for recent groups

---

## Dependencies at Risk

**Next.js 16.0.7 (Recent Major Release):**
- Risk: Recent upgrade (v16 released Jan 2025); potential edge cases with App Router and React 19 integration
- Impact: Breaking changes may not be fully surfaced; performance regressions possible
- Current status: Appears stable; no known issues in recent commits
- Migration plan: Monitor Next.js security updates; test major version upgrades in staging first

**@trpc/server v11.0.0-rc.586 (Release Candidate):**
- Risk: RC version in production; not officially stable
- Impact: Breaking changes possible between RC releases; limited community support
- Current status: Works as of latest commits; no reported issues
- Migration plan: Upgrade to stable v11.0.0 when available; or downgrade to v10 LTS if stability is critical

**Prisma 6.19.2 (Recent Major):**
- Risk: v6 is recent (late 2024); schema migrations may have edge cases
- Impact: Schema evolution could break; generated client may have bugs
- Current status: Migration script exists (src/scripts/migrate.ts); schema appears stable
- Migration plan: Always test schema migrations in staging; keep backups before migrate deploy

---

## Missing Critical Features

**Audit Trail / Activity Logging:**
- Problem: Activity table exists (ActivityType enum in schema), but no UI to view group activity history
- Blocks: Users cannot verify who changed what and when; useful for dispute resolution in shared expenses
- Workaround: Activity logged to database but not visualized; manual DB query required
- Implementation: Build activity-list page (skeleton exists at `src/app/groups/[groupId]/activity/`); display with timestamps, user names, action descriptions

**Export/Reconciliation Reports:**
- Problem: CSV export exists (src/app/groups/[groupId]/expenses/export/csv/route.ts) but no settlement reports
- Blocks: Difficult to reconcile with bank statements; no tax/audit trail format (e.g., for shared business expenses)
- Workaround: Manual spreadsheet export
- Implementation: Add PDF reports with settlement summary; include tax-deductible categorization

**Permission Model / Role-Based Access:**
- Problem: No roles (admin vs participant); all group members can delete expenses, edit settings
- Blocks: Prevents trusted mediator patterns; no way to restrict editing to expense creator
- Workaround: Social trust only
- Implementation: Add Admin role; restrict delete/edit to admin + creator; implement soft-delete with audit trail

---

## Test Coverage Gaps

**Expense Form Component:**
- What's not tested: Form submission, field validation, localStorage default-splitting-options persistence, sub-items field array operations, settlement mode switching logic
- Files: `src/app/groups/[groupId]/expenses/expense-form.tsx` (1830 lines, 0 tests)
- Risk: Regressions in complex form logic go unnoticed; refactoring risky
- Priority: **High** — This is the most critical user journey

**Balance Calculation Edge Cases:**
- What's not tested: Interactions between sub-items + LEASE mode; currency conversion + sub-items; edge case where participant removed after creating expense
- Files: `src/lib/balances.ts`, partial coverage in `balances.test.ts`
- Risk: Complex settlement scenarios could calculate incorrect amounts
- Priority: **High** — Financial calculations must be bulletproof

**UI Components (Radix/shadcn):**
- What's not tested: Select/Dropdown behavior, form field error states, responsive layout on mobile, carousel on receipt upload
- Files: `src/components/ui/*`, `src/components/category-selector.tsx`, `src/components/currency-selector.tsx`
- Risk: UI regressions on different devices/browsers; accessibility issues
- Priority: **Medium** — Visual bugs less severe than calculation bugs

**API Route Error Handling:**
- What's not tested: tRPC error responses, invalid groupId/expenseId handling, permission checks (if added)
- Files: `src/trpc/routers/groups/*/`, `src/lib/api.ts` (error throws)
- Risk: Unhandled errors leak internals to client; poor error messaging
- Priority: **Medium** — Covered by manual testing; automation would prevent regressions

**Locale/i18n Edge Cases:**
- What's not tested: Missing translation keys fallback, RTL languages, currency formatting in different locales, date formatting edge cases
- Files: `src/i18n/request.ts`, usage in all components via `useTranslations()`
- Risk: Locale-specific bugs only surface in deployment
- Priority: **Low** — next-intl is well-tested; edge cases rare

---

## Code Quality Issues

**Console.log/error Statements in Production Code:**
- Instances: 18 console statements found (log, error, warn)
- Files: `src/app/groups/[groupId]/expenses/create-from-receipt-button.tsx` (2 logs during receipt processing), `src/components/async-button.tsx` (console.error on action failure), `src/scripts/migrate.ts` (migration logging)
- Impact: Logs leak internal state; should use structured logging in production
- Fix: Replace with proper logger (winston, pino, or Sentry); remove debug logs in production builds

**Type Safety Reduced by as any (Already Noted Above):**
- Summary: 18+ instances of `as any` in expense-form.tsx alone; masks type mismatches
- Impact: Refactoring hazards; TypeScript provides no safety guarantees
- Priority: Address as part of form refactoring phase

**Inconsistent Error Types:**
- Issue: Mix of plain Error() throws and TRPCError() throws
- Files: `src/lib/api.ts` uses plain Error; `src/trpc/routers/groups/*/` use TRPCError
- Impact: Client must handle both; poor error consistency
- Fix: Standardize on TRPCError for all API boundary errors

---

## Documentation Gaps

**Settlement Modes Logic Not Inline-Documented:**
- Problem: DESIGN.md explains conceptually, but balance calculation code lacks comments explaining WHY each mode works differently
- Files: `src/lib/balances.ts:getSettlementBalances()` (70+ lines, minimal comments)
- Impact: New contributors struggle to understand settlement mode branching
- Fix: Add inline comments explaining NORMAL vs STRAIGHT vs LEASE behavior at each branch

**Lease Feature Interactions Undocumented:**
- Problem: How sub-items interact with lease mode; how buyback date affects timing; buy-in payment flow unclear
- Files: Comments exist but scattered across api.ts, balances.ts, expense-form.tsx
- Impact: Complex feature difficult to modify safely
- Fix: Create LEASE_MODE.md design doc explaining buy-in + buyback flows with state diagrams

---

*Concerns audit: 2026-02-24*
