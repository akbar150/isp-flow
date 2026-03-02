

# Fix Reminder Page Categorization

## Problem 1: "3 Days Before Expiry" missing day 2
Currently the filter only matches `daysDiff === 3` (exactly 3 days from now). It should include both day 2 and day 3 -- i.e., customers expiring the day after tomorrow and the day after that.

**Fix:** Change `daysDiff === 3` to `daysDiff === 2 || daysDiff === 3`

## Problem 2: "All Overdue" limited to 30 days
Currently filters `daysDiff >= -30`, hiding any customer overdue by more than a month. Should show ALL overdue customers regardless of how long ago they expired.

**Fix:** Change `daysDiff <= -1 && daysDiff >= -30` to just `daysDiff <= -1` (no lower bound)

## Category definitions (corrected)
- **Expiring Today**: expiry = today (daysDiff === 0)
- **1 Day Before Expiry**: expiry = tomorrow (daysDiff === 1)
- **3 Days Before Expiry**: expiry in 2-3 days (daysDiff === 2 or 3)
- **All Overdue**: any past expiry (daysDiff <= -1, no limit)

## File to modify
`src/pages/Reminders.tsx` -- lines 105-113, update the categorization conditions

## Technical change
```typescript
// Before:
if (daysDiff === 3) {
  threeDaysBefore.push(customer);
} else if (daysDiff === 1) {
  oneDayBefore.push(customer);
} else if (daysDiff === 0) {
  expiryDay.push(customer);
} else if (daysDiff <= -1 && daysDiff >= -30) {
  allOverdue.push(customer);
}

// After:
if (daysDiff === 2 || daysDiff === 3) {
  threeDaysBefore.push(customer);
} else if (daysDiff === 1) {
  oneDayBefore.push(customer);
} else if (daysDiff === 0) {
  expiryDay.push(customer);
} else if (daysDiff <= -1) {
  allOverdue.push(customer);
}
```
