

# Add "Reset Product Stock & Prices" to Data Reset Panel

## What You Want
Keep the product items (names, categories, etc.) but be able to reset their stock quantities and price values back to zero from the Settings page.

## Changes

### File: `src/components/settings/DataResetPanel.tsx`

Add a separate section below the existing date-range reset tool called **"Reset Product Data"** with checkboxes for:

1. **Reset Stock Quantities** -- Sets `stock_quantity` and `metered_quantity` to 0 on all products
2. **Reset Prices** -- Sets `purchase_price` and `selling_price` to 0 on all products

This will use SQL UPDATE (not DELETE), so the products themselves remain intact. It will have its own confirmation dialog requiring "RESET" to be typed, separate from the date-range deletion tool.

### How It Works
- A new card/section appears below the existing Data Reset date-range tool
- SuperAdmin selects which fields to reset (stock, prices, or both)
- Clicks "Preview Reset" to see how many products will be affected
- Confirms by typing "RESET"
- Runs an UPDATE query on the `products` table setting selected fields to 0

### Technical Details
- Uses `supabase.from('products').update({ stock_quantity: 0, metered_quantity: 0 })` for stock reset
- Uses `supabase.from('products').update({ purchase_price: 0, selling_price: 0 })` for price reset
- No date filtering needed -- applies to all products
- No database migration required -- purely a frontend update to one file

