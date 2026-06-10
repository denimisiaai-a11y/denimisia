# Returns & Refunds — Operator Runbook

This document is the source of truth for how returns work at Denimisia: customer policy, admin workflow, refund procedure, troubleshooting. If the code disagrees with this doc, the code wins — open a PR to fix the doc.

---

## 1. Customer Policy

### Eligibility

- Order must be in status `DELIVERED`.
- Request must be filed within **7 days** of the delivery date (tracked from the `DELIVERED` entry in `OrderStatusHistory`).
- Each item's `product.returnable` flag must be `true` (default for all new products; admin can flip per SKU).
- An item already returned cannot be returned again. Partial returns are tracked per quantity — if 3 of 5 were returned, the remaining 2 stay eligible.

### Reasons and fault mapping

| Reason | Fault | Customer pays return shipping? | Photos required? |
|---|---|---|---|
| `DEFECTIVE` | Us | No (we arrange pickup) | Yes |
| `DAMAGED_IN_TRANSIT` | Us | No | Yes |
| `NOT_AS_DESCRIBED` | Us | No | Yes |
| `WRONG_ITEM_SENT` | Us | No | Yes |
| `WRONG_SIZE` | Customer | Yes | Optional |
| `CHANGED_MIND` | Customer | Yes | Optional |

Admins can override the auto-assigned fault on manual returns. Photo requirement is enforced client-side and server-side.

### Photos

- Max 5 photos per request.
- 10 MB max per file.
- Formats: JPEG, PNG, WebP.
- Required for any US-fault reason (the four "Us" rows above).
- Customer storefront currently accepts URL paste (max 5 URLs). Admins uploading manual returns use the existing R2 image uploader.

### Refunds

- Methods: `CASH` or `BANK_TRANSFER`. No store credit, no gateway integration for v1.
- Refund amount is admin-entered — there is no auto-calc. For per-item returns of a bundle: use `bundleDiscountedPrice ÷ itemCount` as the baseline (a helper exists in `ReturnsRefundService.computeBundleItemRefund`).
- Original shipping cost is **not** refunded.
- No restocking fee in v1.
- Refunds are issued only after **inspection passes**. Cash payouts must record a voucher/receipt number in the `reference` field. Bank transfers must record the bank txn id.

### SLA

- Acknowledged: every submission triggers an email confirming 48-hour review window.
- Past-SLA returns surface in red on the admin list page (tab: "Past SLA"). These are returns in `REQUESTED` or `UNDER_REVIEW` whose `slaDeadline` has passed.

### Customer flow

1. Customer visits `/returns` → "Start a return"
2. Logged in: pick from dropdown of eligible orders.  
   Guest: enter order #, email, phone.
3. Pick items + quantities, choose reason, optional description, paste photo URLs if needed.
4. Submit → receives RTN ID + email confirmation.
5. Tracks at `/returns/{rtnNumber}` (auth required, or guest with email+phone).
6. May cancel while still in `REQUESTED` state.

---

## 2. State Machine

```
REQUESTED
  ├→ UNDER_REVIEW
  │    ├→ APPROVED
  │    │    ├→ IN_TRANSIT   ─→ RECEIVED ─→ INSPECTING
  │    │    └→ RECEIVED     ─→ INSPECTING
  │    │                              ├→ INSPECTED_PASS  ─→ REFUNDED ─→ CLOSED
  │    │                              └→ INSPECTED_FAIL  ─→ RETURNED_TO_CUSTOMER ─→ CLOSED
  │    │                                                 └→ (admin override) REFUNDED ─→ CLOSED
  │    └→ REJECTED ─→ CLOSED
  └→ CANCELLED ─→ CLOSED
```

The transition table is the authoritative source in [`apps/api/src/modules/returns/returns.state-machine.ts`](../apps/api/src/modules/returns/returns.state-machine.ts). Every transition is validated by `canTransition()` before the DB write.

---

## 3. Admin Workflow

Find returns at `/returns` in the admin panel. Tabs filter by status: All / Requested / Under Review / Approved / Received / Inspecting / Refunded / Past SLA.

### REQUESTED → UNDER_REVIEW

Click "Start Review" on the detail page. Optional notes. Triggers no customer email.

### UNDER_REVIEW → APPROVED

Click "Approve". Modal collects:
- Carrier (optional)
- Pickup address (optional, JSON object — only needed if we're arranging pickup because it's our fault)
- Approval notes (optional)

Customer receives an email with shipping instructions or pickup window.

### UNDER_REVIEW → REJECTED

Click "Reject". Modal requires a rejection reason. Customer receives an email with the reason. Return is closed.

### APPROVED → RECEIVED

Click "Mark Received" when the package arrives at warehouse. Optional tracking # + notes. Customer receives confirmation email.

Note: `IN_TRANSIT` is in the state machine but no controller endpoint creates that transition yet. The page allows "Mark Received" directly from `APPROVED` or `IN_TRANSIT`. If you need a formal `IN_TRANSIT` step, add a `PATCH /admin/returns/:id/mark-in-transit` endpoint.

### RECEIVED → INSPECTING

Click "Start Inspection". No modal. Indicates the warehouse team is now physically inspecting the items.

### INSPECTING → INSPECTED_PASS / INSPECTED_FAIL

Inline form. Per item:
- **PASS** or **FAIL** radio
- **Restock?** checkbox — only check if the item is in sellable condition. Damaged-but-PASS items should leave restock unchecked.

Optional inspection notes apply to the whole return.

Result depends on items:
- All PASS → return moves to `INSPECTED_PASS`. Inventory is **not** restocked yet — that happens at refund time.
- Any FAIL → return moves to `INSPECTED_FAIL`.

### INSPECTED_PASS → REFUNDED

Click "Issue Refund". Modal collects:
- Amount (positive number, BDT)
- Method (Cash or Bank Transfer)
- Reference — required. Cash: voucher/receipt number. Bank transfer: bank txn id / wire reference.
- Notes (optional)

On submit, atomically:
1. A `RefundTransaction` ledger row is created.
2. The return moves to `REFUNDED` with `refundAmount`/`Method`/`Reference` stamped.
3. For each item with `inspectionResult=PASS` AND `restock=true`, the variant's `stock` is incremented by the returned quantity.

Customer receives a refund confirmation email with the amount + method + reference.

### INSPECTED_FAIL — two options

**Option A: Ship back to customer.** Click "Ship Back to Customer". The return moves to `RETURNED_TO_CUSTOMER` and is closed. Customer was already notified at the FAIL transition (handled by the email listener on `return.inspected_fail`).

**Option B: Override and refund anyway.** Click "Override · Refund Anyway". Same refund modal as PASS, but the request body sets `overrideFromFail: true`. Use sparingly — typically when admin decides the item is bad enough but customer still deserves the refund (e.g., minor damage we want to absorb as goodwill).

### REQUESTED → CANCELLED

Customer-initiated only (via the storefront tracking page). Admin cannot cancel another user's return — they would reject it instead.

---

## 4. Manual Return Entry

Use when a customer walks in, calls, or emails outside the storefront flow.

Navigate to `/returns/manual` in the admin panel.

Fields:
- **Order Reference** (optional) — if known, paste the order id. Form looks up the order; on success, items section shows a dropdown of order line items.
- **Customer name** (required)
- **Customer phone** (required)
- **Customer email** (optional, but recommended for email notifications to work)
- **Reason** (required)
- **Fault override** (optional) — defaults to the reason's fault mapping; override only if you have a reason.
- **Description** (optional, max 2000 chars)
- **Photos** — uses the R2 image uploader; up to 5 files.
- **Items** — at least one. Per row, either:
  - Pick an order item from the dropdown (only available if an order was looked up), or
  - Manual entry: product name, SKU, size, color, unit price, quantity.

Submit creates the return with `isManual=true`. From there, the same admin workflow applies — review, approve, mark received, inspect, refund.

Manual returns can exist standalone (no order linked) for walk-ins with no order on file. Skip the order field in that case.

---

## 5. Refund Procedure (off-system)

The system records the refund. The actual money movement happens off-system.

### Cash refund

1. Open the return at `/returns/{id}`.
2. Hand over cash to the customer in person or arrange a courier handoff. Get a signed voucher or print a receipt.
3. Click "Issue Refund" → method=Cash → reference=voucher number (e.g. "VCH-2026-001").
4. The refund email goes out automatically.

### Bank transfer refund

1. Initiate the transfer in your bank's portal first. Save the txn id.
2. Open the return, click "Issue Refund" → method=Bank Transfer → reference=the txn id.
3. The refund email goes out with the reference so the customer can match it against their statement.

**Never** issue the system-side refund before money has actually moved. The `RefundTransaction` ledger is immutable — no edits, no deletes. If you record the wrong amount or reference, document the correction in your accounting system; the ledger entry stays.

---

## 6. Email Notifications

Templates live in [`apps/api/src/modules/email/email-templates.ts`](../apps/api/src/modules/email/email-templates.ts). Listener at [`apps/api/src/common/listeners/return-email.listener.ts`](../apps/api/src/common/listeners/return-email.listener.ts).

| Event | Template | Trigger |
|---|---|---|
| `return.requested` | `returnSubmitted` | Customer submits a request |
| `return.approved` | `returnApproved` | Admin approves; copy varies by `customerShipsBack` |
| `return.rejected` | `returnRejected` | Admin rejects |
| `return.received` | `returnReceived` | Admin marks package received |
| `return.refunded` | `returnRefunded` | Refund issued |

All emails include a tracking link to `/returns/{rtnNumber}` on the storefront. Errors in email dispatch are logged but **never** fail the state transition — the customer's return progresses even if the email broker is down.

---

## 7. Troubleshooting

### "Customer's return shows OVERDUE in admin"

The 48h SLA has elapsed without admin movement past `UNDER_REVIEW`. Open the return, decide approve or reject, take the action. SLA red flag clears automatically when status leaves `REQUESTED` / `UNDER_REVIEW`.

### "Inspection failed but customer is escalating — how do I refund anyway?"

Use the **Override · Refund Anyway** button on `INSPECTED_FAIL` returns. Records the refund and stamps the same `RefundTransaction`. Note: items with `restock=true` will still be restocked even when refunding from FAIL — be careful to uncheck restock on damaged items in the inspection step before completing it.

### "Customer says they got a wrong refund amount"

The `RefundTransaction` ledger is the source of truth. Look it up under `/returns/{id}` — the refund card shows the recorded amount + method + reference. If wrong: the ledger entry cannot be deleted. You'll need to:
1. Issue a manual top-up refund off-system (cash or bank).
2. Record the correction in your accounting books — out of scope for this system.
3. Optionally create a manual `RefundTransaction` adjustment if you extend the system in the future.

### "How do I see how much we've refunded this month?"

Hit `/returns/metrics` in the admin panel. The "Pending Refund Value" card is for active (not-yet-refunded) returns. For historical refund totals, query the database directly:

```sql
SELECT
  date_trunc('month', "issuedAt") AS month,
  COUNT(*) AS refund_count,
  SUM("amount") AS total_refunded
FROM "RefundTransaction"
WHERE "issuedAt" >= NOW() - INTERVAL '12 months'
GROUP BY month
ORDER BY month DESC;
```

### "Can the customer reopen a closed return?"

No. The state machine terminates on `CLOSED`. They must submit a new request, which gets a new RTN ID. If the original was closed in error, the closed return still exists in the DB for audit — there's just no UI to reopen it.

### "What if a customer requests a return on a guest order?"

Their order has `guestEmail` + `guestPhone` populated. The storefront submission form prompts for these to match against the order. The admin sees them under the customer info card.

### "Customer's tracking link 404s"

Confirm the RTN number is correct (format `RTN-YYYY-NNNNNN`, 6-digit padded). Confirm the user is logged in OR providing matching email+phone on the lookup form. If still 404, check the `Return.userId` and `Return.guestEmail`/`guestPhone` columns in the DB — those are the matching fields.

### "Inventory restock isn't increasing the variant stock"

Restock happens only when ALL of these are true:
- `inspectionResult = PASS` on that ReturnItem
- `restock = true` on that ReturnItem
- The ReturnItem has an `orderItemId` (not a manual entry)
- The OrderItem has a `variantId` (some legacy items may not)

Check those four conditions on the affected row before assuming a bug.

---

## 8. Future Work (deferred from v1)

- **`mark-in-transit` endpoint** — the FSM allows `APPROVED → IN_TRANSIT` but no controller route creates the transition. Add when reverse-logistics tracking is needed.
- **Pagination on `/returns/me`** — currently unbounded. Add `take` + cursor when high-volume customers appear.
- **Phone normalization** — guest phone comparison is strict equality. Apply E.164 normalization when project-wide phone convention is set.
- **Idempotency on submit** — a double-POST creates two returns. Add an idempotency key header pattern.
- **Audit log integration** — admin transitions emit events but don't yet write to the `AuditLog` table. Add a listener that writes one entry per state change.
- **Customer name on admin list** — the list endpoint doesn't currently join `Order.user`. Logged-in customer returns display "Customer" placeholder. Extend `ReturnsService.listForAdmin` to include `order.user.firstName/lastName/email`.
- **Customer photo upload** — currently URL-paste only on storefront. Wire a customer-side R2 presigned upload to match the admin uploader.
- **Audit of `RefundTransaction` corrections** — no support for adjustments yet. Add when accounting workflow requires it.
- **Per-item refund amount** — `ReturnItem.itemRefundAmount` column exists but is unused. Wire it when partial-amount refunds are needed (e.g., refund only 80% of an item due to wear).

---

## 9. Quick Reference

- **API base**: `/returns` (customer), `/admin/returns` (admin)
- **State machine**: [`apps/api/src/modules/returns/returns.state-machine.ts`](../apps/api/src/modules/returns/returns.state-machine.ts)
- **Eligibility logic**: [`apps/api/src/modules/returns/returns.eligibility.ts`](../apps/api/src/modules/returns/returns.eligibility.ts)
- **Service**: [`apps/api/src/modules/returns/returns.service.ts`](../apps/api/src/modules/returns/returns.service.ts)
- **Refund service**: [`apps/api/src/modules/returns/returns.refund.service.ts`](../apps/api/src/modules/returns/returns.refund.service.ts)
- **Admin pages**: [`apps/admin/app/(dashboard)/returns/`](../apps/admin/app/(dashboard)/returns/)
- **Customer pages**: [`apps/web/app/returns/`](../apps/web/app/returns/), [`apps/web/app/account/returns/`](../apps/web/app/account/returns/)
- **Email templates**: [`apps/api/src/modules/email/email-templates.ts`](../apps/api/src/modules/email/email-templates.ts)
