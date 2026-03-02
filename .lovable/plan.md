
# Sort Reminders by Expiry Date

## Changes to `src/pages/Reminders.tsx`

### 1. Default sort: Latest expiry date first
After categorizing customers, sort each array so that the most recent (nearest/latest) expiry date appears first. For overdue, this means the most recently expired customer is at the top.

Add sorting after categorization (around line 114-116):
```typescript
const sortByExpiry = (a: Customer, b: Customer) => 
  new Date(b.expiry_date).getTime() - new Date(a.expiry_date).getTime();

threeDaysBefore.sort(sortByExpiry);
oneDayBefore.sort(sortByExpiry);
expiryDay.sort(sortByExpiry);
allOverdue.sort(sortByExpiry);
```

### 2. Add clickable sort toggle on "Expiry" column header
- Add state: `sortDirection` (`'desc' | 'asc'`) defaulting to `'desc'` (latest first)
- Make the "Expiry" `<th>` clickable with an arrow icon (ArrowUpDown from lucide-react)
- When toggled, reverse the sort direction for all tables
- Pass the sort direction into `renderCustomerTable` and apply sorting there

### Technical detail
- Add `useState` for `sortDirection`
- Import `ArrowUpDown` from lucide-react
- In `renderCustomerTable`, sort the list based on `sortDirection` before mapping
- The `<th>` for Expiry becomes a clickable button with the sort icon
