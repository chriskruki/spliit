# Technology Stack

**Analysis Date:** 2026-02-24

## Languages

**Primary:**
- TypeScript 5.3.3 - Core language for frontend and backend
- JavaScript - Configuration files and scripts

**Secondary:**
- CSS - Via Tailwind and PostCSS for styling

## Runtime

**Environment:**
- Node.js 21 (Alpine) - Base runtime for development and production (see `Dockerfile`)

**Package Manager:**
- npm (via package-lock.json) - Version not explicitly pinned in package.json

## Frameworks

**Core:**
- Next.js 16.0.7 - Full-stack React framework with App Router
- React 19.2.1 - UI library

**Internationalization:**
- next-intl 4.5.8 - Multi-language support for 20+ languages (French, German, Spanish, Italian, Japanese, etc.)
  - Configuration: `src/app/layout.tsx` uses NextIntlClientProvider
  - Messages: `/messages/` directory with locale JSON files (e.g., `en-US.json`, `de-DE.json`)

**UI & Styling:**
- Tailwind CSS 3 - Utility-first CSS framework
- Tailwind Plugins:
  - @tailwindcss/typography 0.5.10
  - tailwindcss-animate 1.0.7
  - tailwind-merge 1.14.0
- PostCSS 8 - CSS processing (configured in `postcss.config.js`)
- Autoprefixer 10 - Vendor prefixing

**UI Component Libraries:**
- Radix UI 1.x - Accessible component primitives
  - @radix-ui/react-checkbox 1.3.3
  - @radix-ui/react-collapsible 1.1.12
  - @radix-ui/react-dialog 1.1.15
  - @radix-ui/react-dropdown-menu 2.1.16
  - @radix-ui/react-hover-card 1.1.15
  - @radix-ui/react-label 2.1.8
  - @radix-ui/react-popover 1.1.15
  - @radix-ui/react-radio-group 1.3.8
  - @radix-ui/react-select 2.2.6
  - @radix-ui/react-slot 1.2.4
  - @radix-ui/react-tabs 1.1.13
  - @radix-ui/react-toast 1.2.15
  - @radix-ui/react-icons 1.3.2
- lucide-react 0.501.0 - Icon library
- cmdk 1.1.1 - Command palette/search
- vaul 1.1.2 - Drawer component
- embla-carousel-react 8.6.0 - Carousel/slider component

**Forms & Data:**
- React Hook Form 7.68.0 - Form state management
- @hookform/resolvers 3.3.2 - Schema resolvers for validation
- Zod 3.23.8 - TypeScript-first schema validation

**Data Fetching & Caching:**
- tRPC 11.0.0-rc.586 - End-to-end type-safe APIs
  - @trpc/client 11.0.0-rc.586
  - @trpc/react-query 11.0.0-rc.586
  - @trpc/server 11.0.0-rc.586
- @tanstack/react-query 5.59.15 - Server state management and caching
- SWR 2.3.3 - Data fetching library (lightweight alternative/complement)

**Data Transformation:**
- superjson 2.2.1 - JSON serializer supporting additional types (Decimal, Date, etc.)
  - Used in tRPC to handle Prisma Decimal types
- ts-pattern 5.0.6 - Type-safe pattern matching

**Database:**
- Prisma 6.19.2 - ORM and database toolkit
  - Generator: prisma-client-js
  - Database provider: PostgreSQL with connection pooling (POSTGRES_PRISMA_URL) and direct connection (POSTGRES_URL_NON_POOLING)
  - Schema: `prisma/schema.prisma`
  - Migrations: `prisma/migrations/`

**File Upload & Storage:**
- next-s3-upload 0.3.4 - Presigned S3 upload handler
  - Supports AWS S3 and compatible providers (via S3_UPLOAD_ENDPOINT)
  - Configuration in `src/app/api/s3-upload/route.ts`

**AI/ML Integration:**
- openai 4.25.0 - OpenAI API client
  - Used for receipt extraction and category prediction via GPT models
  - Configuration in `src/lib/env.ts` (OPENAI_API_KEY)

**Date/Time:**
- dayjs 1.11.10 - Lightweight date manipulation library
- Prisma includes built-in DateTime handling

**Utilities:**
- uuid 9.0.1 - UUID generation
- nanoid 5.0.4 - Nano ID generation
- clsx 2.0.0 - Conditional className builder
- class-variance-authority 0.7.0 - Type-safe component variant management
- use-debounce 10.0.4 - Debouncing hook
- react-intersection-observer 10.0.0 - Intersection Observer hook
- client-only 0.0.1 - Assertion library to prevent server-side rendering
- server-only 0.0.1 - Assertion library for server components
- @formatjs/intl-localematcher 0.5.4 - Locale matching for i18n
- negotiator 0.6.3 - HTTP content negotiation
- content-disposition 0.5.4 - Content-Disposition header handling
- sharp 0.33.2 - Image processing

**Data Export:**
- @json2csv/plainjs 7.0.6 - JSON to CSV conversion

## Testing

**Test Framework:**
- Jest 29.7.0 - Testing framework
- jest-environment-jsdom 29.7.0 - Browser environment simulation for tests
- Configuration: `jest.config.ts`

**Testing Libraries:**
- @testing-library/react 16.3.0 - React component testing utilities
- @testing-library/dom 10.4.0 - DOM testing utilities
- @testing-library/jest-dom 6.4.8 - Jest matchers for DOM

## Build & Dev Tools

**Build:**
- Next.js built-in build system (ESBuild/SWC)

**Type Checking:**
- TypeScript 5.3.3 - Static type checking
- @total-typescript/ts-reset 0.5.1 - Better TypeScript defaults

**Linting & Formatting:**
- ESLint 9.39.1 - JavaScript linting
  - eslint-config-next 16.0.7 - Next.js specific rules
- Prettier 3.0.3 - Code formatter
  - prettier-plugin-organize-imports 3.2.3 - Auto-organize imports

**TypeScript Configuration:**
- tsconfig.json - Base configuration with path aliases (@/*)
- ts-node 10.9.2 - TypeScript execution for Node.js scripts
- tsconfig-paths 4.2.0 - Resolve tsconfig path aliases in Node.js

**Environment:**
- dotenv 16.3.1 - Environment variable loading

## Configuration Files

**Build Configuration:**
- `next.config.mjs` - Next.js configuration
  - next-intl plugin for internationalization
  - S3 remote image patterns (optional)
- `jest.config.ts` - Jest test runner configuration
- `.eslintrc.json` - ESLint rules (extends next/core-web-vitals)
- `.prettierrc` - Prettier formatting (no semi, single quotes, organize imports)
- `tsconfig.json` - TypeScript compiler options
- `postcss.config.js` - PostCSS plugins (Tailwind, Autoprefixer)
- `tailwind.config.js` - Tailwind CSS theming

**Package Configuration:**
- `package.json` - Project dependencies and scripts

## Scripts

**Development:**
- `npm run dev` - Next.js dev server (port 3000)
- `npm run build` - Production build
- `npm run start` - Start production server

**Code Quality:**
- `npm run lint` - ESLint
- `npm run check-types` - tsc type checking
- `npm run check-formatting` - Prettier check
- `npm run prettier` - Auto-format with Prettier

**Database:**
- `npm run postinstall` - Prisma migration and generation (runs automatically)

**Testing:**
- `npm run test` - Jest test suite

**Utilities:**
- `npm run generate-currency-data` - Generate currency data via ts-node

**Docker:**
- `npm run build-image` - Build Docker image
- `npm run start-container` - Run with docker-compose

## Platform Requirements

**Development:**
- Node.js 21 (Alpine recommended)
- npm
- PostgreSQL database (local or remote)
- Optional: OpenAI API key for receipt/category extraction
- Optional: AWS S3 or compatible object storage for expense documents

**Production:**
- Docker (Node.js 21 Alpine multi-stage build)
- PostgreSQL database with connection pooling
- S3-compatible object storage (optional)
- OpenAI API key (optional)

## Environment Configuration

**Critical Environment Variables:**
- `POSTGRES_PRISMA_URL` - PostgreSQL connection string (with pooling)
- `POSTGRES_URL_NON_POOLING` - Direct PostgreSQL connection (for migrations)

**Feature Flags:**
- `NEXT_PUBLIC_ENABLE_EXPENSE_DOCUMENTS` - Enable file uploads to S3
- `NEXT_PUBLIC_ENABLE_RECEIPT_EXTRACT` - Enable OpenAI receipt extraction
- `NEXT_PUBLIC_ENABLE_CATEGORY_EXTRACT` - Enable OpenAI category prediction

**S3 Configuration (optional):**
- `S3_UPLOAD_KEY` - AWS access key
- `S3_UPLOAD_SECRET` - AWS secret key
- `S3_UPLOAD_BUCKET` - S3 bucket name
- `S3_UPLOAD_REGION` - AWS region
- `S3_UPLOAD_ENDPOINT` - Custom S3 endpoint (for non-AWS providers)

**AI Configuration (optional):**
- `OPENAI_API_KEY` - OpenAI API key for GPT models

**Other:**
- `NEXT_PUBLIC_BASE_URL` - Application base URL (defaults to Vercel URL or localhost:3000)
- `NEXT_PUBLIC_DEFAULT_CURRENCY_CODE` - Default currency code for new groups
- `NEXT_TELEMETRY_DISABLED` - Disable Next.js telemetry (set to 1 in production)

## Validation

Environment variables are validated using Zod schema in `src/lib/env.ts`:
- Database URLs are required
- S3 configuration is conditionally required if NEXT_PUBLIC_ENABLE_EXPENSE_DOCUMENTS is true
- OpenAI API key is required if receipt or category extraction is enabled

---

*Stack analysis: 2026-02-24*
