# Spliit

## What This Is

A group expense splitting app for roommates and friends. Users create groups, add expenses with different split modes (evenly, by shares, by percentage, by amount), and see who owes whom. Built with Next.js, tRPC, Prisma, and PostgreSQL. No authentication — groups are accessed via shareable IDs.

## Core Value

Accurate balance calculations across three settlement modes (normal, straight, lease) so roommates always know exactly what they owe each other.

## Requirements

### Validated

- ✓ Group creation and management with shareable IDs — existing
- ✓ Expense creation with multiple split modes (evenly, shares, percentage, amount) — existing
- ✓ Expense sub-items with independent split modes — existing
- ✓ Normal settlement mode with net balance calculation — existing
- ✓ Straight settlement mode with gross (non-netting) balances — existing
- ✓ Lease settlement mode with buy-in and buyback phases — existing
- ✓ Suggested reimbursements for normal balances — existing
- ✓ Recurring expenses — existing
- ✓ Receipt extraction via OpenAI (optional) — existing
- ✓ S3 document upload (optional) — existing
- ✓ Multi-language support (20+ locales) — existing
- ✓ Activity log / audit trail — existing
- ✓ Expense categories with optional AI prediction — existing
- ✓ Docker containerization support — existing

### Active

- [ ] Test balance calculation logic for all three settlement modes (normal netting, straight gross, lease buy-in/buyback)
- [ ] Deploy to Digital Ocean droplet for private roommate use

### Out of Scope

- Authentication / user accounts — app uses shareable group IDs by design
- New feature development — focus is validation and deployment only
- CI/CD pipeline — manual deployment is sufficient for private use

## Context

Chris and roommates (Evan, Cole) use this app to track shared expenses. Three settlement modes exist:

- **Normal**: Standard expense splitting. Balances are netted (if A owes B $500 and B owes A $500, they cancel out to $0).
- **Straight**: Like normal but balances are NOT netted. Shown separately from normal balances. If A owes B $500 and B owes A $500, both debts are displayed individually.
- **Lease**: For shared assets (e.g., $800 TV). Buy-in phase: roommates pitch in their share. Buyback phase: when moving out, the original buyer repurchases their shares at the same split amount.

The codebase already has these features implemented. The goal is to verify the math works correctly through tests, then deploy for actual use.

### Technical Environment

- Next.js 16 + React 19 + tRPC + Prisma 6 + PostgreSQL
- Jest for testing, co-located test files
- Docker multi-stage build available
- Balance calculation logic lives in `src/lib/balances.ts`
- Existing test file: `src/lib/balances.test.ts`

## Constraints

- **Deployment**: Digital Ocean droplet (fresh) — need PostgreSQL + Node.js runtime
- **Users**: 3 roommates (Chris, Evan, Cole) — small scale, private use
- **Budget**: Minimal — basic droplet sufficient

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Docker deployment on DO | Already has Dockerfile, simplifies setup | — Pending |
| Focus testing on balance math only | Core risk is calculation correctness, not UI | — Pending |
| No authentication | Private use with 3 roommates, shared group IDs sufficient | ✓ Good |

---
*Last updated: 2026-02-24 after initialization*
