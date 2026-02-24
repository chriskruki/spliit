# External Integrations

**Analysis Date:** 2026-02-24

## APIs & External Services

**OpenAI:**
- Service: GPT API for receipt and expense analysis
- What it's used for:
  - Receipt image extraction (amount, category, date, title)
  - Expense category prediction
- SDK/Client: `openai` ^4.25.0
- Auth: Environment variable `OPENAI_API_KEY`
- Implementation files:
  - `src/app/groups/[groupId]/expenses/create-from-receipt-button-actions.ts`
  - `src/components/expense-form-actions.tsx`
- Model: `gpt-5-nano` (for receipt extraction)
- Feature flags:
  - `NEXT_PUBLIC_ENABLE_RECEIPT_EXTRACT` - Toggle receipt extraction
  - `NEXT_PUBLIC_ENABLE_CATEGORY_EXTRACT` - Toggle category prediction
- Configuration: Validated in `src/lib/env.ts` - required if extraction features are enabled

## Data Storage

**Databases:**

**PostgreSQL (Primary):**
- Provider: Self-hosted or managed PostgreSQL service
- Connection types:
  - Connection pooling: `POSTGRES_PRISMA_URL` (for application queries)
  - Direct connection: `POSTGRES_URL_NON_POOLING` (for migrations and setup)
- ORM/Client: Prisma 6.19.2
- Schema location: `prisma/schema.prisma`
- Migrations: `prisma/migrations/` (auto-applied via postinstall hook)
- Key tables:
  - Groups - Expense group definitions
  - Participants - Group members
  - Expenses - Individual expenses with split modes and settlement modes
  - ExpensePaidFor - Many-to-many split tracking
  - ExpenseSubItem - Detailed line items within expenses
  - SubItemPaidFor - Sub-item split tracking
  - Activity - Audit log of group changes
  - Category - Expense categories
  - ExpenseDocument - Uploaded receipt images
  - RecurringExpenseLink - Recurring expense tracking
  - LeaseBuyInPayment - Lease settlement tracking

**File Storage:**

**AWS S3 (or S3-compatible):**
- Service: Object storage for expense documents (receipts, invoices)
- SDK/Client: `next-s3-upload` ^0.3.4
- Auth: `S3_UPLOAD_KEY`, `S3_UPLOAD_SECRET`
- Configuration:
  - Bucket: `S3_UPLOAD_BUCKET`
  - Region: `S3_UPLOAD_REGION`
  - Custom endpoint: `S3_UPLOAD_ENDPOINT` (optional, for non-AWS providers)
- Presigned upload handler: `src/app/api/s3-upload/route.ts`
- Client hook: `usePresignedUpload()` for browser uploads
- Feature flag: `NEXT_PUBLIC_ENABLE_EXPENSE_DOCUMENTS`
- Implementation:
  - `src/app/groups/[groupId]/expenses/create-from-receipt-button.tsx`
  - `src/components/expense-documents-input.tsx`
- File naming: `document-{timestamp}-{randomId}.{extension}`
- Image optimization: Next.js Image component with S3 remote patterns configured in `next.config.mjs`

**Caching:**
- In-memory: React Query (@tanstack/react-query) with custom query client
- No external cache provider (Redis/Memcached) configured

## Authentication & Identity

**Auth Provider:**
- Custom: No authentication provider (app is public/no-auth)
- Implementation: Groups are identified by ID, no user accounts required
- Access control: None enforced at API level; reliant on URL-based group IDs

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or similar integration

**Logs:**
- Console-based: Uses standard console methods for logging
- Environment: `NEXT_TELEMETRY_DISABLED=1` in production (disables Next.js telemetry)
- Health endpoints: `src/app/api/health/` with liveness and readiness probes

## CI/CD & Deployment

**Hosting:**
- Vercel (detected via environment variable handling)
  - `VERCEL_URL` environment variable detected in `src/trpc/client.tsx` and `src/lib/env.ts`
- Docker (optional)
  - Multi-stage Dockerfile for containerized deployment
  - Alpine Linux base (Node.js 21)
  - Docker Compose available in `.devcontainer/`

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or similar workflow files

**Build System:**
- Next.js built-in build (Vercel standard)
- Docker multi-stage build support (base → runtime-deps → runner)

## Environment Configuration

**Required Environment Variables:**
- `POSTGRES_PRISMA_URL` - PostgreSQL connection string with pooling
- `POSTGRES_URL_NON_POOLING` - Direct PostgreSQL connection for migrations

**Optional Environment Variables (Feature-Dependent):**

If `NEXT_PUBLIC_ENABLE_EXPENSE_DOCUMENTS=true`:
- `S3_UPLOAD_KEY` - AWS access key
- `S3_UPLOAD_SECRET` - AWS secret key
- `S3_UPLOAD_BUCKET` - S3 bucket name
- `S3_UPLOAD_REGION` - AWS region (e.g., us-east-1)
- `S3_UPLOAD_ENDPOINT` - Optional custom endpoint for non-AWS providers

If `NEXT_PUBLIC_ENABLE_RECEIPT_EXTRACT=true` or `NEXT_PUBLIC_ENABLE_CATEGORY_EXTRACT=true`:
- `OPENAI_API_KEY` - OpenAI API key for GPT access

**Application Configuration:**
- `NEXT_PUBLIC_BASE_URL` - Application base URL (auto-set to Vercel URL or defaults to http://localhost:3000)
- `NEXT_PUBLIC_DEFAULT_CURRENCY_CODE` - Default currency code for groups
- `NEXT_PUBLIC_ENABLE_RECEIPT_EXTRACT` - Boolean feature flag
- `NEXT_PUBLIC_ENABLE_CATEGORY_EXTRACT` - Boolean feature flag
- `NEXT_PUBLIC_ENABLE_EXPENSE_DOCUMENTS` - Boolean feature flag
- `NEXT_TELEMETRY_DISABLED` - Set to 1 in production to disable Next.js telemetry

**Secrets Location:**
- `.env` (development - do not commit)
- `.env.example` - Template with example values (see `/.env.example`)
- Environment variables injected at runtime in production (Vercel/Docker)

## Webhooks & Callbacks

**Incoming:**
- Not detected - No webhook endpoints for external integrations

**Outgoing:**
- Not detected - No outgoing webhooks to external services

## Integration Patterns

**Server Actions (Next.js 13+):**
- Receipt extraction uses server actions: `extractExpenseInformationFromImage()` in `src/app/groups/[groupId]/expenses/create-from-receipt-button-actions.ts`
- Marks functions with `'use server'` directive
- Configuration: `allowedOrigins: ['localhost:3000']` in `next.config.mjs` for codespaces compatibility

**tRPC Procedures:**
- All data operations go through tRPC endpoints
- Location: `src/trpc/routers/`
- Adapter: `@trpc/server/adapters/fetch` for Next.js App Router
- Endpoint: `/api/trpc`

**Presigned Upload Flow:**
1. Browser requests presigned URL from `/api/s3-upload`
2. Next.js backend generates signed request using AWS SDK
3. Browser uploads directly to S3 using presigned URL
4. Expense document metadata stored in PostgreSQL via tRPC

---

*Integration audit: 2026-02-24*
