# Architecture

**Analysis Date:** 2026-02-24

## Pattern Overview

**Overall:** Full-Stack Next.js with tRPC RPC framework, Prisma ORM, and PostgreSQL database

**Key Characteristics:**
- Next.js 16 App Router for server and client components
- Type-safe RPC calls via tRPC with React Query integration
- PostgreSQL with Prisma ORM for data persistence
- Client-side state management with React Query
- Internationalization (i18n) with next-intl
- Component library (Radix UI + shadcn/ui) for UI
- Complex business logic for expense splitting and balance calculations

## Layers

**Presentation Layer:**
- Purpose: Server and Client React components for UI rendering
- Location: `src/app/**` (pages, layouts) and `src/components/**` (reusable components)
- Contains: React components (.tsx files), forms, modals, cards, lists
- Depends on: tRPC client, hooks, utilities, i18n
- Used by: End users via browser

**API/tRPC Layer:**
- Purpose: Type-safe RPC procedures that bridge frontend and backend
- Location: `src/trpc/routers/**` (organized by domain - groups, categories)
- Contains: tRPC procedures (.procedure.ts files) implementing query and mutation operations
- Depends on: Business logic layer, database layer (Prisma)
- Used by: Client components via tRPC client

**Business Logic Layer:**
- Purpose: Core domain logic for calculations and data transformations
- Location: `src/lib/**` (balances.ts, api.ts, schemas.ts)
- Contains: Balance calculations, expense distribution logic, validation schemas
- Depends on: Database layer (Prisma), utilities
- Used by: tRPC layer, components

**Data Access Layer:**
- Purpose: Database interactions and ORM abstraction
- Location: Prisma client (`src/lib/prisma.ts`) and schema (`prisma/schema.prisma`)
- Contains: Prisma models, migrations, database configuration
- Depends on: PostgreSQL database
- Used by: Business logic and API layers

**Utilities & Infrastructure:**
- Purpose: Cross-cutting concerns and helper functions
- Location: `src/lib/` (utils, currency, locale, hooks, env)
- Contains: Format utilities, locale handling, environment config, custom hooks
- Depends on: External libraries
- Used by: All layers

## Data Flow

**Expense Creation Flow:**

1. User submits form in `src/app/groups/[groupId]/expenses/create-expense-form.tsx`
2. Client validates with `expenseFormSchema` from `src/lib/schemas.ts`
3. Client calls `groups.expenses.create` via tRPC mutation
4. tRPC procedure in `src/trpc/routers/groups/expenses/create.procedure.ts` validates input
5. Business logic in `src/lib/api.ts` processes with `createExpense()`
6. Prisma writes to database via `src/lib/prisma.ts`
7. React Query invalidates cache, component refetches `groups.expenses.list`
8. Balance components auto-update via `getSettlementBalances()` from `src/lib/balances.ts`

**Balance Calculation Flow:**

1. Component requests expense data via `groups.expenses.list` tRPC query
2. Data flows to `getSettlementBalances()` in `src/lib/balances.ts`
3. Expenses are categorized by `settlementMode` (NORMAL, STRAIGHT, LEASE)
4. For NORMAL mode: `getBalances()` distributes amounts using split mode logic
5. For STRAIGHT mode: `getStraightBalanceItems()` creates direct participant-to-participant records
6. For LEASE mode: `getLeaseItems()` computes buyback and buy-in breakdowns
7. `getSuggestedReimbursements()` optimizes normal reimbursement suggestions
8. UI renders via components in `src/app/groups/[groupId]/balances/` and related

**State Management:**

- Server-side: React `cache()` for request-level deduplication in `src/trpc/init.ts`
- Client-side: React Query manages data fetching, caching, and synchronization
- Form state: React Hook Form in expense and group forms
- Local storage: User preferences (theme, locale, default splitting options)
- No Zustand/Redux: tRPC + React Query handle most state needs

## Key Abstractions

**Settlement Modes:**
- Purpose: Different ways to calculate and settle balances
- Examples: `src/lib/balances.ts` - NORMAL (split and reimburse), STRAIGHT (direct), LEASE (buy-in/buyback)
- Pattern: Each mode has dedicated calculation functions; expenses marked with enum in schema

**Split Modes:**
- Purpose: Different ways to divide expense amounts among participants
- Examples: EVENLY, BY_SHARES, BY_PERCENTAGE, BY_AMOUNT
- Pattern: `distributeAmount()` in `src/lib/balances.ts` handles all split logic; used for both expenses and sub-items

**Expense Sub-Items:**
- Purpose: Allow line-item breakdowns within a single expense
- Examples: `ExpenseSubItem` model in `prisma/schema.prisma`
- Pattern: Each sub-item has independent split mode; remainder of parent expense uses parent split

**Activities/Audit Log:**
- Purpose: Track group changes for activity timeline
- Examples: `src/trpc/routers/groups/activities/` router
- Pattern: `ActivityType` enum (UPDATE_GROUP, CREATE_EXPENSE, etc.) logged via `logActivity()` in api.ts

**Recurring Expenses:**
- Purpose: Automatically create future instances of repeating expenses
- Examples: `RecurrenceRule` enum (DAILY, WEEKLY, MONTHLY); `RecurringExpenseLink` model
- Pattern: One-way link from current expense to next; each expense independent after creation

## Entry Points

**Web Application:**
- Location: `src/app/layout.tsx` (root layout with TRPCProvider, theme, i18n setup)
- Triggers: Browser navigation to app domain
- Responsibilities: Sets up global providers, renders header/footer, initializes i18n and theme

**Group Creation Flow:**
- Location: `src/app/groups/page.tsx` and `/create/page.tsx`
- Triggers: User clicks "Create Group" button
- Responsibilities: Routes to group creation form, handles initial setup

**Group Detail View:**
- Location: `src/app/groups/[groupId]/page.tsx` (redirects to /expenses)
- Triggers: User opens specific group
- Responsibilities: Redirects to expenses tab (primary view)

**tRPC API Entry:**
- Location: `src/app/api/trpc/[trpc]/route.ts`
- Triggers: tRPC client calls from frontend
- Responsibilities: Routes RPC calls to appropriate procedures in `src/trpc/routers/`

## Error Handling

**Strategy:** Zod validation first, then Prisma constraint errors, React Query error states

**Patterns:**
- Form validation: `expenseFormSchema` and `groupFormSchema` in `src/lib/schemas.ts` catch client-side errors
- tRPC procedures: Input validation via Zod; Prisma errors bubble to frontend
- UI error display: Components check React Query error state, show toast notifications via Toaster
- Custom hooks: `src/lib/hooks.ts` may contain error boundary or error handling patterns

## Cross-Cutting Concerns

**Logging:**
- Activity logging via `logActivity()` in `src/lib/api.ts` to Activity model
- Console logs can be enabled in dev via Prisma log config

**Validation:**
- Zod schemas in `src/lib/schemas.ts` for forms (groupFormSchema, expenseFormSchema)
- Schema validation ensures data integrity before database writes
- Nested schema validation for paidFor arrays, sub-items, and settlement modes

**Authentication:**
- No authentication layer detected; app is public/session-less
- All groups accessed via shareable IDs (nanoid)
- No user accounts or permission model

**Internationalization:**
- next-intl middleware and provider in root layout
- Language files likely in `src/i18n/`
- LocaleSwitcher component in `src/components/locale-switcher.tsx`
- t() and t.rich() functions used throughout for translations

**Currency Handling:**
- Amounts stored as integers (cents) in Prisma
- Currency codes (ISO 4217) stored per group
- Currency conversion supported via originalAmount, originalCurrency, conversionRate fields
- Currency data in `src/lib/currency-data.json` for symbol lookups

---

*Architecture analysis: 2026-02-24*
