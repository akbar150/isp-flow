
# Fix Address Length Mismatch in Bulk Upload

## Root Cause
The database has a constraint `check_address_length` requiring addresses to be **at least 10 characters** and at most 500 characters. However, the bulk upload validation in the code only checks for a minimum of 4 characters. This mismatch means rows pass client-side validation but get rejected by the database.

## Two Fixes

### 1. Update client-side validation in `BulkCustomerUpload.tsx`
Change the address validation from `min 4 chars` to `min 10 chars` so users see the error before attempting to import:
- Line ~280: Change `row.address.trim().length < 4` to `row.address.trim().length < 10`
- Update the error message from "min 4 chars" to "min 10 chars"

### 2. Auto-pad short addresses during import
Since many real-world addresses from ISP systems are short area names, also update the import logic to automatically append ", Bangladesh" to addresses shorter than 10 characters. This ensures short area names like "Vata" become "Vata, Bangladesh" (16 chars) and pass the constraint.

In the `handleImport` function (~line 565), change:
```
address: row.address.trim()
```
to:
```
address: row.address.trim().length < 10 
  ? row.address.trim() + ", Bangladesh" 
  : row.address.trim()
```

### 3. Also improve error display during import
Update the error logging in `handleImport` to show the actual database error message in the results panel, so if future constraint violations occur, users can see exactly what went wrong instead of just "Failed to import row X".

## Technical Details
- The `check_address_length` constraint: `CHECK (length(TRIM(BOTH FROM address)) >= 10 AND length(address) <= 500)`
- Current client validation: checks for >= 4 characters (mismatch)
- The edge function `import-customers-bulk` also constructs addresses as `zone + ", Bangladesh"` which naturally passes the constraint -- the bulk upload should follow the same pattern
