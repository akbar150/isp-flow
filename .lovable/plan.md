

# Add Customer ID Column to Customer Table

## Overview
Add the Customer ID (`user_id`) as the last column before the Actions column in the customer table.

## Changes to `src/pages/Customers.tsx`

### 1. Add "Customer ID" column header
Insert `<th>Customer ID</th>` after the Status column and before Actions (line 553).

### 2. Add Customer ID cell in each row
Insert a `<td>` displaying `customer.user_id` in a mono font, positioned after the Status cell and before the Actions cell.

### 3. Update colspan
Change the "No customers found" colspan from 8 to 9.

## Files to modify
- `src/pages/Customers.tsx`

