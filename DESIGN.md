# Spliit Fork: Settlement Modes & Enhanced Payout Dashboard

## The Problem

Spliit (and Splitwise before it) treats **all expenses as fungible** — everything gets netted into one simplified "A owes B $X" balance. This works great for groceries and dinner, but completely breaks down for roommate scenarios where:

- **Big shared purchases** (TV, furniture) need to be "rented" short-term and bought back later
- **Rent/security deposit** payments need a clean paper trail — you can't net rent against pizza
- **Everyday expenses** (groceries, household supplies) are fine to net-settle

---

## The Three Settlement Modes

### 1. 🟢 **Normal Mode** — Net Settle (existing Spliit behavior)
> *"Simplify all debts"*

- All expenses in this mode get pooled together
- The app's existing algorithm flattens the debt graph to minimize # of payments
- **Use for:** Groceries, dining, household supplies, entertainment

### 2. 🔵 **Straight Mode** — Direct Payback, No Netting
> *"Keep a paper trail"*

- Each expense stays as its own line item
- Balances are **never** netted or simplified with other expenses
- A→B for rent stays separate from B→A for utilities
- Shows up as discrete "you owe $X for [Rent - February]" entries
- **Use for:** Rent, security deposit, utility bills, anything that needs receipts/proof

### 3. 🟡 **Lease Mode** — Shared Now, Buyback Later
> *"Rent to own"*

- One person buys an item; everyone splits it initially
- A **buyback date** is set (e.g., end of lease)
- On buyback, the original buyer "pays back" everyone else's share
- Until buyback: treated like a normal split expense
- On buyback: the system generates reverse reimbursement entries
- **Use for:** TV, furniture, appliances — anything one person will keep

---

## How Each Mode Affects the Balance Dashboard

```
┌─────────────────────────────────────────────────────────┐
│  GROUP: Apartment 2025                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  NORMAL BALANCES (net settled)              [$-23.50]   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  You owe Mike: $23.50                           │   │
│  │  (groceries, dining, household — 12 expenses)   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  STRAIGHT BALANCES (paper trail)            [$-1,850]   │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ► Rent - Feb 2025         You → Mike  $625.00  │   │
│  │  ► Security Deposit        You → Mike  $625.00  │   │
│  │  ► Electric - Feb 2025     Mike → You  $45.00   │   │
│  │  ► Internet - Feb 2025     You → Sara  $30.00   │   │
│  │  ...each line is a discrete payable              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  LEASE ITEMS (shared, pending buyback)      [$0.00]     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📺 55" Samsung TV          Owner: You           │   │
│  │     Bought: $600 | Split: 3 ways | Your cost now:│   │
│  │     $200 | Buyback due: Aug 2025                 │   │
│  │     Status: ● Active — roommates using           │   │
│  │     On buyback you pay back: $400 total          │   │
│  │       → Mike: $200                               │   │
│  │       → Sara: $200                               │   │
│  │                                                   │   │
│  │  🛋️ IKEA Couch              Owner: Mike           │   │
│  │     Bought: $900 | Split: 3 ways                 │   │
│  │     Buyback due: Aug 2025                        │   │
│  │     On buyback Mike pays back: $600 total        │   │
│  │       → You: $300                                │   │
│  │       → Sara: $300                               │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ═══════════════════════════════════════════════════    │
│  TOTAL YOU OWE (all modes):               $1,873.50    │
│  TOTAL OWED TO YOU:                       $345.00      │
│  ─────────────────────────────────────────────────      │
│  NET:                                     -$1,528.50   │
│  (excluding lease buybacks not yet triggered)           │
└─────────────────────────────────────────────────────────┘
```

---

## Architecture: What to Change in Spliit

### Database Schema Changes (Prisma)

The core change is adding a `settlementMode` enum to the `Expense` model:

```prisma
// New enum
enum SettlementMode {
  NORMAL    // existing behavior — net settle
  STRAIGHT  // no netting, 1:1 paper trail
  LEASE     // shared now, buyback later
}

// Modified Expense model
model Expense {
  // ... existing fields ...
  
  settlementMode  SettlementMode @default(NORMAL)
  
  // Lease-mode specific fields
  leaseOwnerId    String?        // participant who keeps the item
  leaseOwner      Participant?   @relation("LeaseOwner", fields: [leaseOwnerId], references: [id])
  leaseBuybackDate DateTime?     // when the owner pays everyone back
  leaseBuybackCompleted Boolean  @default(false)
  leaseItemName   String?        // "55-inch Samsung TV"
}
```

### Key Source Files to Modify

Based on Spliit's architecture (Next.js + tRPC + Prisma):

| File/Area | What to Change |
|---|---|
| `prisma/schema.prisma` | Add `SettlementMode` enum, new fields on `Expense` |
| `src/lib/balances.ts` (or equivalent) | Split balance calculation into 3 pipelines by mode |
| Expense form component | Add settlement mode selector + conditional lease fields |
| Balances page/component | Render 3 separate sections instead of 1 flattened view |
| tRPC router for expenses | Accept and validate new fields |
| Reimbursement suggestion logic | Only suggest reimbursements for NORMAL mode expenses |

### Balance Calculation Logic (Pseudocode)

```typescript
function getGroupBalances(expenses: Expense[], participants: Participant[]) {
  const normalExpenses = expenses.filter(e => e.settlementMode === 'NORMAL');
  const straightExpenses = expenses.filter(e => e.settlementMode === 'STRAIGHT');
  const leaseExpenses = expenses.filter(e => e.settlementMode === 'LEASE');

  return {
    // Existing Spliit algorithm — net settle, minimize transfers
    normal: calculateNetSettledBalances(normalExpenses, participants),

    // Each expense is its own line item — no simplification
    straight: straightExpenses.map(expense => ({
      expense,
      from: getOwingParticipants(expense),
      to: expense.paidBy,
      amounts: getIndividualAmounts(expense),
    })),

    // Group by lease item, show buyback status
    lease: leaseExpenses.map(expense => ({
      expense,
      owner: expense.leaseOwner,
      totalCost: expense.amount,
      ownerShare: getParticipantShare(expense, expense.leaseOwnerId),
      buybackAmount: expense.amount - getParticipantShare(expense, expense.leaseOwnerId),
      buybackDate: expense.leaseBuybackDate,
      buybackCompleted: expense.leaseBuybackCompleted,
      buybackBreakdown: getBuybackAmounts(expense), // who gets paid back how much
    })),
    
    // Grand totals across all modes
    totals: calculateGrandTotals(normalExpenses, straightExpenses, leaseExpenses),
  };
}
```

---

## Implementation Plan (Phased)

### Phase 1: Schema + Expense Form (Day 1-2)
1. Fork the repo, add `SettlementMode` enum to Prisma schema
2. Run `prisma migrate dev` to generate migration
3. Add settlement mode picker to the expense creation form (radio buttons or segmented control)
4. Conditionally show lease fields (owner, buyback date, item name) when LEASE is selected
5. Update tRPC mutation to accept new fields

### Phase 2: Balance Calculation Engine (Day 2-3)
1. Refactor `getGroupBalances` to filter expenses by mode
2. Keep existing net-settle algorithm for NORMAL
3. Build STRAIGHT balance: simple list of per-expense debts
4. Build LEASE balance: item-centric view with buyback math
5. Write unit tests for each calculation path

### Phase 3: Dashboard UI (Day 3-4)
1. Redesign the balances page with 3 collapsible sections
2. NORMAL section: existing simplified view
3. STRAIGHT section: line-item table with individual "mark as paid" buttons
4. LEASE section: card-based view for each item with progress/countdown
5. Grand total summary at top or bottom

### Phase 4: Lease Buyback Flow (Day 4-5)
1. Add "Trigger Buyback" button on lease items
2. When triggered: auto-generate reimbursement expenses (owner pays each participant back)
3. Mark lease as `buybackCompleted`
4. Move the buyback amounts into the participant's balance view

### Phase 5: Polish + Deploy (Day 5-6)
1. Mobile responsiveness
2. Add mode filter/toggle to the expense list page
3. Export functionality (CSV/PDF) that respects modes
4. Deploy to Vercel with your PostgreSQL instance

---

## UX Design Decisions

### Expense Creation Flow
```
[Create Expense]
  ├── Title: "55-inch Samsung TV"
  ├── Amount: $600.00
  ├── Paid by: You
  ├── Split between: [You] [Mike] [Sara]
  ├── Split type: Evenly | By shares | By % | By amount
  │
  └── Settlement Mode: (NEW)
       ○ Normal — nets with other expenses
       ● Lease — shared purchase, one keeper
       ○ Straight — stays as-is, paper trail
       
       [Lease Options — shown when Lease selected]
       ├── Item name: Samsung TV
       ├── Who keeps it: [You ▼]
       └── Buyback date: [Aug 1, 2025]
```

### Dashboard Layout Priorities
1. **At-a-glance**: Show the total net across all modes at the top
2. **Normal**: Collapsed by default if $0 balance, expanded otherwise
3. **Straight**: Always expanded — these are the "action items" (rent due, etc.)
4. **Lease**: Visual cards with item name, emoji/icon, and countdown to buyback

### Color Coding
- 🟢 Normal = Green accent (settled, simplified)
- 🔵 Straight = Blue accent (documented, official)
- 🟡 Lease = Amber/Yellow accent (pending, temporal)

---

## Edge Cases to Handle

1. **What if a lease participant moves out before buyback?**
   → Allow early buyback trigger, or allow transferring their share to the owner immediately

2. **What if a straight expense involves the same two people multiple times?**
   → Show each as a separate line. Optionally group by "paid to" with expandable details, but never auto-net

3. **Can you change an expense's mode after creation?**
   → Yes, but warn that it may affect existing balance calculations. Recalculate on save.

4. **Mixed scenarios: someone pays rent AND buys groceries in the same group?**
   → This is the whole point — the modes coexist in the same group. The dashboard shows all three.

5. **Lease item partial buyback?**
   → Could support this in v2. For v1, buyback is all-or-nothing.

---

## Quick Start: Forking & Running

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/spliit.git
cd spliit

# Start local PostgreSQL
./scripts/start-local-db.sh

# Install dependencies
npm install

# Create your migration
npx prisma migrate dev --name add-settlement-modes

# Run dev server
npm run dev
```

---

## Summary

This fork adds **settlement modes** to Spliit — a concept that's missing from every major expense-splitting app. The key insight is that not all shared expenses are equal: some should be netted, some need paper trails, and some are temporary arrangements with a defined end date. By categorizing expenses at creation time, the balance dashboard becomes dramatically more useful for real-world roommate and group-living scenarios.