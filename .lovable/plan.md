

## Show All Overdue Customers (from Day 1)

### Problem
The Reminders page "3+ Days Overdue" tab only shows customers whose expiry is 3 or more days past (`daysDiff <= -3`). Customers who expired yesterday or 2 days ago are not displayed anywhere.

### Solution
Change the overdue filter from `daysDiff <= -3` to `daysDiff <= -1` (any customer past their expiry date), and rename the tab label from "3+ Days Overdue" to "All Overdue".

### File: `src/pages/Reminders.tsx`

**Line 95**: Rename variable from `threeDaysOverdue` to `allOverdue`

**Line 111**: Change condition from `daysDiff <= -3 && daysDiff >= -30` to `daysDiff <= -1 && daysDiff >= -30`

**Line 116-119**: Update variable name references

**Line 287**: Change label from `"3+ Days Overdue"` to `"All Overdue"` and use updated variable name

