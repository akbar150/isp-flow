

# Package Change Billing Issue — Analysis and Solution

## The Problem

When customer "easy351-rabbi.kg" changed from **Sync-36Mbps-800-Unlimited (৳800)** to **FRN-8Mbps (৳600)**, the system's `total_due` was already set to ৳800 (from the old package's billing cycle). After paying ৳600, the system shows ৳200 due — but the customer's current package only costs ৳600, so the due should be ৳0.

**Root cause**: The `total_due` on the customer record was accumulated based on the old package price. When the package changes, `total_due` is not adjusted to reflect the new package price. The `generate-billing` edge function adds `pkg.monthly_price` to `total_due` at expiry — but if the bill was generated before the package change, the old price sticks.

## Current Package Change Flow (via edge function)

The `package-change` edge function **does** calculate proration and adjusts `total_due`:
```
netCharge = prorated_charge (new pkg) - prorated_credit (old pkg)
newDue = customer.total_due + netCharge
```

But this only works when the package change goes through the **portal request → admin approval** flow. If an admin manually changes a customer's package (e.g., editing the customer record directly), there's no due adjustment — the old `total_due` remains.

## Proposed Solution

### 1. Add due adjustment on manual package change
When an admin changes a customer's package via the Customer Edit dialog, automatically recalculate and adjust `total_due` based on the price difference.

**In `CustomerEditDialog.tsx`**: When `package_id` changes during save:
- Fetch old and new package prices
- If `total_due > 0`, adjust: `new_due = total_due - old_price + new_price`
- If `total_due = 0` (already paid), leave it at 0

### 2. Fix the Quick Payment dialog to show package-aware due
**In `QuickPaymentRecord.tsx`**: The "Current Due" and "Full Month" buttons should always reflect the **current** package price, not the stale `total_due` from a previous package.

### 3. Fix the Payments page payment form
**In `Payments.tsx`**: When selecting a customer, auto-fill the amount with the customer's **current** package `monthly_price`, and show a warning if `total_due` doesn't match the current package price.

## Files to Modify

1. **`src/components/CustomerEditDialog.tsx`** — Add due adjustment logic when package changes
2. **`src/components/QuickPaymentRecord.tsx`** — No changes needed (already receives `monthlyPrice` from parent)
3. **`src/pages/Payments.tsx`** — Auto-fill amount with current package price when customer selected
4. **`supabase/functions/package-change/index.ts`** — Already handles proration correctly (no change needed)

## Technical Details

### CustomerEditDialog package change adjustment:
```typescript
// On save, if package_id changed:
if (newPackageId !== originalPackageId) {
  const oldPrice = oldPackage?.monthly_price || 0;
  const newPrice = newPackage?.monthly_price || 0;
  const priceDiff = newPrice - oldPrice; // negative if downgrade
  const adjustedDue = Math.max(0, currentTotalDue + priceDiff);
  // Include adjustedDue in the update
}
```

### Payments page customer selection:
When a customer is selected in the payment form, pre-fill the amount field with their current `packages.monthly_price` instead of leaving it blank.

