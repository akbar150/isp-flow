

## Bug Fix: Phone Number Validation Regex

### Problem
The `isValidBDPhone` function in `src/lib/phoneUtils.ts` has a wrong regex pattern. Bangladesh mobile numbers are 13 digits (e.g., `8801766866997`), but the current regex `/^880[13-9]\d{8}$/` only matches 12-digit strings (880 + 1 digit + 8 digits = 12).

This causes ALL valid phone numbers to be rejected when adding or editing customers.

### Fix
**File:** `src/lib/phoneUtils.ts` (line 28)

Change the regex from:
```
/^880[13-9]\d{8}$/
```
To:
```
/^880[13-9]\d{9}$/
```

This makes the total match 13 digits (880 + 1 operator digit + 9 remaining digits), which is the correct Bangladesh mobile number format.

### Impact
This single-line fix resolves phone validation errors in:
- Add New Customer dialog
- Edit Customer dialog
- Bulk customer import
- Any other place using `isValidBDPhone`

