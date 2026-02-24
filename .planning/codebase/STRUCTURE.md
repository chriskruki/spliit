# Codebase Structure

**Analysis Date:** 2026-02-24

## Directory Layout

```
spliit/
├── src/                       # Application source code
│   ├── app/                   # Next.js App Router pages and layouts
│   │   ├── layout.tsx         # Root layout (providers, header, footer)
│   │   ├── page.tsx           # Landing/homepage
│   │   ├── api/               # API routes
│   │   │   ├── trpc/          # tRPC endpoint
│   │   │   ├── health/        # Health check endpoints
│   │   │   └── s3-upload/     # S3 upload endpoint
│   │   └── groups/            # Group-related pages
│   │       ├── page.tsx       # Groups list
│   │       ├── [groupId]/     # Group detail routes
│   │       │   ├── layout.tsx # Group layout wrapper
│   │       │   ├── page.tsx   # Group redirect
│   │       │   ├── expenses/  # Expense management
│   │       │   ├── balances/  # Balance views
│   │       │   ├── activities/ # Activity log
│   │       │   ├── stats/     # Statistics
│   │       │   ├── edit/      # Group editing
│   │       │   └── information/ # Group info
│   │       └── create/        # Group creation
│   │
│   ├── components/            # Reusable React components
│   │   ├── ui/                # shadcn/ui + Radix UI primitives
│   │   ├── group-form.tsx     # Group creation/edit form
│   │   ├── expense-form.tsx   # Expense form logic
│   │   ├── category-selector.tsx # Category picker
│   │   ├── currency-selector.tsx # Currency picker
│   │   ├── theme-provider.tsx # Theme setup
│   │   └── ... (other shared components)
│   │
│   ├── trpc/                  # tRPC setup and routers
│   │   ├── init.ts            # tRPC context, router factory
│   │   ├── client.ts          # Client-side tRPC configuration
│   │   ├── query-client.ts    # React Query setup
│   │   └── routers/           # Domain-specific routers
│   │       ├── _app.ts        # Root router combining all routers
│   │       ├── groups/        # Groups router and sub-routers
│   │       │   ├── index.ts   # Groups router definition
│   │       │   ├── create.procedure.ts
│   │       │   ├── get.procedure.ts
│   │       │   ├── getDetails.procedure.ts
│   │       │   ├── list.procedure.ts
│   │       │   ├── update.procedure.ts
│   │       │   ├── expenses/  # Expense procedures
│   │       │   │   ├── index.ts
│   │       │   │   ├── create.procedure.ts
│   │       │   │   ├── update.procedure.ts
│   │       │   │   ├── delete.procedure.ts
│   │       │   │   ├── get.procedure.ts
│   │       │   │   ├── list.procedure.ts
│   │       │   │   ├── toggle-lease-buyback.procedure.ts
│   │       │   │   ├── toggle-lease-buyback-active.procedure.ts
│   │       │   │   └── toggle-lease-buyin.procedure.ts
│   │       │   ├── balances/  # Balance calculation procedures
│   │       │   ├── activities/ # Activity log procedures
│   │       │   └── stats/     # Statistics procedures
│   │       └── categories/    # Categories router
│   │           └── list.procedure.ts
│   │
│   ├── lib/                   # Business logic and utilities
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── api.ts             # Database operations (createExpense, createGroup, etc.)
│   │   ├── balances.ts        # Balance calculations and settlement logic
│   │   ├── person-balances.ts # Per-person balance utilities
│   │   ├── totals.ts          # Summary calculations
│   │   ├── schemas.ts         # Zod validation schemas
│   │   ├── utils.ts           # Helper functions
│   │   ├── currency.ts        # Currency formatting
│   │   ├── locale.ts          # Locale utilities
│   │   ├── hooks.ts           # Custom React hooks
│   │   ├── env.ts             # Environment variable validation
│   │   ├── featureFlags.ts    # Feature flag logic
│   │   ├── health.ts          # Health check functions
│   │   └── currency-data.json # Currency codes and symbols
│   │
│   ├── i18n/                  # Internationalization
│   │   └── (translation files and i18n configuration)
│   │
│   └── scripts/               # Utility scripts
│       └── generateCurrencyData.ts # Generate currency data
│
├── prisma/                    # Database schema and migrations
│   ├── schema.prisma          # Prisma data model
│   └── migrations/            # Database migration history
│
├── public/                    # Static assets
│   ├── logo-with-text.png
│   ├── banner.png
│   └── (other images and icons)
│
├── .planning/                 # Planning and documentation
│   └── codebase/              # Generated codebase analysis
│
├── Configuration files:
│   ├── package.json           # npm dependencies and scripts
│   ├── tsconfig.json          # TypeScript configuration
│   ├── jest.config.ts         # Jest testing configuration
│   ├── eslint.config.mjs      # ESLint rules
│   ├── .prettierrc             # Prettier formatting rules
│   └── next.config.js         # Next.js configuration (if exists)
│
└── scripts/                   # Build and deployment scripts
    └── build-image.sh         # Docker image builder
```

## Directory Purposes

**src/app/**
- Purpose: Next.js App Router page components and API routes
- Contains: Page.tsx files, layout.tsx files, route handlers
- Key files: `layout.tsx` (root), `page.tsx` (landing), `api/trpc/` (RPC endpoint)

**src/components/**
- Purpose: Reusable UI components for rendering
- Contains: React component files (.tsx), UI primitives from Radix UI/shadcn, domain components
- Key files: `group-form.tsx`, `expense-form.tsx`, `ui/` (button, dialog, etc.)

**src/trpc/routers/**
- Purpose: tRPC procedure definitions organized by domain
- Contains: One .procedure.ts per tRPC operation, index.ts files that export routers
- Key files: `_app.ts` (root router), `groups/index.ts`, `groups/expenses/index.ts`

**src/lib/**
- Purpose: Business logic, utilities, and data access layer
- Contains: Core algorithms, validation schemas, Prisma client, API functions
- Key files: `balances.ts` (settlement logic), `api.ts` (CRUD operations), `schemas.ts` (validation)

**prisma/**
- Purpose: Database schema definition and migration history
- Contains: schema.prisma (Prisma model definitions), migrations/ (SQL migration files)
- Key files: `schema.prisma` (defines Group, Expense, Participant, etc.)

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout with TRPCProvider, theme, i18n setup
- `src/app/page.tsx`: Landing page with hero section and CTA
- `src/app/api/trpc/[trpc]/route.ts`: tRPC RPC endpoint
- `src/trpc/routers/_app.ts`: Root tRPC router aggregating all sub-routers

**Configuration:**
- `package.json`: Dependencies and npm scripts
- `tsconfig.json`: TypeScript compiler options with path aliases (@/*)
- `jest.config.ts`: Jest test runner configuration
- `eslint.config.mjs`: ESLint linting rules
- `.prettierrc`: Prettier formatting preferences

**Core Logic:**
- `src/lib/api.ts`: Database operations (createGroup, createExpense, updateExpense, logActivity, etc.)
- `src/lib/balances.ts`: Balance calculations (getBalances, getSuggestedReimbursements, getSettlementBalances)
- `src/lib/schemas.ts`: Zod validation for forms (groupFormSchema, expenseFormSchema)
- `src/trpc/routers/groups/expenses/`: Expense CRUD and lease management procedures

**Testing:**
- `src/lib/balances.test.ts`: Unit tests for balance calculation logic
- `src/lib/utils.test.ts`: Tests for utility functions
- `jest.config.ts`: Jest configuration

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js convention)
- Layouts: `layout.tsx`
- Server components: PascalCase (e.g., `group-header.tsx` exports `GroupHeader`)
- Client components: `.client.tsx` suffix (e.g., `page.client.tsx`)
- Server actions: `.action.ts` or `-actions.ts` suffix
- tRPC procedures: `.procedure.ts` suffix (e.g., `create.procedure.ts`)
- Test files: `.test.ts` or `.spec.ts` suffix
- Route handlers: `route.ts` in `api/` directories

**Directories:**
- Feature routes: `[paramName]/` for dynamic segments (e.g., `[groupId]/`)
- Domain routers: lowercase (e.g., `groups/`, `categories/`)
- UI components: `ui/` prefix for primitive components
- Utilities: `lib/` for business logic and helpers

## Where to Add New Code

**New Feature (e.g., new domain like "Payments"):**
- Primary code: `src/trpc/routers/payments/` (create index.ts, individual .procedure.ts files)
- Business logic: `src/lib/payments.ts` (calculation/validation functions)
- Components: `src/components/payment-*.tsx` or feature-specific folder
- Tests: `src/lib/payments.test.ts`
- Pages: `src/app/groups/[groupId]/payments/page.tsx` (if route needed)

**New tRPC Procedure:**
- Location: `src/trpc/routers/{domain}/{action}.procedure.ts`
- Pattern: Create baseProcedure.input(...).query/mutation(async ({input}) => {...})
- Register: Import and add to router's index.ts createTRPCRouter call
- Schema: Define Zod input schema before .input() call

**New Component:**
- Location: `src/components/{name}.tsx` (if shared) or near where used
- Pattern: Export default or named React component (typically TSX)
- Type: Consider if server/client based on data needs

**New Page Route:**
- Location: `src/app/{path}/page.tsx` where {path} matches route structure
- Pattern: async component for Server Components, client components for interactivity
- Layout: Use `layout.tsx` in directory for shared wrappers

**Utilities/Helpers:**
- Location: `src/lib/{domain}.ts` (e.g., balances.ts, currency.ts)
- Pattern: Export functions with clear names, place pure logic here
- Testing: Add .test.ts file alongside utility

**UI Primitives:**
- Location: `src/components/ui/` for shadcn/ui components
- Pattern: Auto-generated via shadcn/ui CLI
- No manual edits unless fixing bugs

## Special Directories

**src/trpc/routers/**
- Purpose: tRPC procedure definitions
- Generated: No (hand-written procedures)
- Committed: Yes
- Pattern: One domain = one router folder; each operation = one procedure file

**prisma/migrations/**
- Purpose: Database schema evolution history
- Generated: Auto-generated by Prisma migrate commands
- Committed: Yes (part of versioning)
- Note: Run `prisma migrate deploy` to apply in production

**node_modules/**
- Purpose: npm dependencies
- Generated: Yes (npm install)
- Committed: No (.gitignored)

**postgres-data/**
- Purpose: Local PostgreSQL database volume
- Generated: Yes (Docker volume)
- Committed: No (.gitignored)

**.next/**
- Purpose: Next.js build output and cache
- Generated: Yes (next build)
- Committed: No (.gitignored)

**public/**
- Purpose: Static assets served at root
- Generated: No (hand-created)
- Committed: Yes
- Accessible: `/logo-with-text.png` → `public/logo-with-text.png`

---

*Structure analysis: 2026-02-24*
