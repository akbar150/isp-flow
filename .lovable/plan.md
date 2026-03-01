

# Fix Address Validation and Bulk Upload Errors

## Problem
1. The database constraint `check_address_length` requires addresses to be at least **10 characters**, but you need it to accept **4 characters minimum**.
2. The client-side validation in BulkCustomerUpload was also set to 10, causing valid short addresses to fail.

## Changes

### 1. Database Migration: Relax address constraint from 10 to 4
Update the `check_address_length` constraint on the `customers` table:
```text
DROP CONSTRAINT check_address_length;
ADD CONSTRAINT check_address_length CHECK (length(TRIM(BOTH FROM address)) >= 4 AND length(address) <= 500);
```

### 2. Update client-side validation in `BulkCustomerUpload.tsx`
- Change address validation back from `min 10 chars` to `min 4 chars` (line 280-281)
- Remove the auto-padding logic that appends ", Bangladesh" (line 565) since 4-char addresses are now valid in the database
- Keep the auto-pad as a fallback only if address is completely empty

### 3. Update `AddCustomerDialog.tsx` (if applicable)
Ensure any other customer creation forms also use min 4 chars for address validation to stay consistent.

## Technical Details

**Files to modify:**
- New database migration SQL (alter constraint)
- `src/components/BulkCustomerUpload.tsx` -- revert validation to 4 chars, simplify address handling

