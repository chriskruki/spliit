# Roadmap: Spliit

## Overview

Two-phase delivery: first verify the balance calculation math is correct across all three settlement modes (normal, straight, lease), then deploy the verified app to a Digital Ocean droplet so Chris, Evan, and Cole can use it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Balance Verification** - Prove the math is correct across all three settlement modes via tests
- [ ] **Phase 2: Deployment** - Get the verified app running on Digital Ocean for roommates

## Phase Details

### Phase 1: Balance Verification
**Goal**: Confidence that balance calculations are correct for normal, straight, and lease modes
**Depends on**: Nothing (first phase)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07
**Success Criteria** (what must be TRUE):
  1. Normal mode netting test passes: A owes B $500 and B owes A $500 produces $0 net balance
  2. Normal mode correctly distributes splits for all four split modes (evenly, shares, percentage, amount)
  3. Straight mode test passes: both individual debts shown separately, no netting applied
  4. Lease buy-in test passes: $800 split three ways calculates correct per-person amounts
  5. Lease buyback test passes: repurchase amounts match the original buy-in split amounts
**Plans**: TBD

### Phase 2: Deployment
**Goal**: App accessible over the network on a fresh Digital Ocean droplet
**Depends on**: Phase 1
**Requirements**: DEPL-01, DEPL-02, DEPL-03
**Success Criteria** (what must be TRUE):
  1. App loads in a browser via the droplet's IP address or domain
  2. Roommates can create a group, add expenses, and see balances without any errors
  3. Deployment steps are documented so the setup can be reproduced
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Balance Verification | 0/TBD | Not started | - |
| 2. Deployment | 0/TBD | Not started | - |
