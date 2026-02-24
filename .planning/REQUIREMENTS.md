# Requirements: Spliit

**Defined:** 2026-02-24
**Core Value:** Accurate balance calculations across three settlement modes (normal, straight, lease) so roommates always know exactly what they owe each other.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Testing — Balance Calculation Verification

- [ ] **TEST-01**: Normal mode netting works correctly (A owes B $500, B owes A $500 nets to $0)
- [ ] **TEST-02**: Normal mode distributes splits correctly across all split modes (evenly, shares, percentage, amount)
- [ ] **TEST-03**: Straight mode shows gross balances without netting (both debts shown individually)
- [ ] **TEST-04**: Straight balances displayed separately from normal balances
- [ ] **TEST-05**: Lease buy-in calculates correct split amounts (e.g., $800 TV / 3 = $266.67 each)
- [ ] **TEST-06**: Lease buyback calculates correct repurchase amounts matching original buy-in splits
- [ ] **TEST-07**: Lease mode tracks buy-in vs buyback phases correctly

### Deployment

- [ ] **DEPL-01**: App runs on fresh Digital Ocean droplet with PostgreSQL
- [ ] **DEPL-02**: Deployment instructions documented for reproducing the setup
- [ ] **DEPL-03**: App accessible over the network for roommates

## v2 Requirements

### Enhancements

- **ENH-01**: CI/CD pipeline for automated deployments
- **ENH-02**: SSL/HTTPS with domain name
- **ENH-03**: Automated database backups

## Out of Scope

| Feature | Reason |
|---------|--------|
| New feature development | Focus is validation and deployment only |
| Authentication system | App uses shareable group IDs by design |
| UI/component testing | Focus is on balance calculation math |
| Load/performance testing | 3 users, not needed |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TEST-01 | TBD | Pending |
| TEST-02 | TBD | Pending |
| TEST-03 | TBD | Pending |
| TEST-04 | TBD | Pending |
| TEST-05 | TBD | Pending |
| TEST-06 | TBD | Pending |
| TEST-07 | TBD | Pending |
| DEPL-01 | TBD | Pending |
| DEPL-02 | TBD | Pending |
| DEPL-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 10 total
- Mapped to phases: 0
- Unmapped: 10

---
*Requirements defined: 2026-02-24*
*Last updated: 2026-02-24 after initial definition*
