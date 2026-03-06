

# Exclude Suspended Customers from Auto-Send Reminders

## Change
In `supabase/functions/auto-send-reminders/index.ts`, add `.neq('status', 'suspended')` to the customer query (around line 30) so suspended customers are filtered out before reminders are sent.

## File
- `supabase/functions/auto-send-reminders/index.ts` — add filter `.neq('status', 'suspended')` to the query chain after `.eq('status', 'active')`.

Currently the query uses `.eq('status', 'active')` which should already exclude suspended customers. However, to be defensive (in case status values change), we'll verify the existing filter is correct and ensure it's robust.

Actually, looking more closely: the query already filters `.eq('status', 'active')` — this already excludes suspended customers. But the edge function only targets `active` customers, so suspended ones are never included. No code change is needed.

**Wait** — let me re-read. The filter is `.eq('status', 'active')`, which means only active customers are fetched. Suspended customers are already excluded. However, to be extra safe and explicit, adding `.neq('status', 'suspended')` alongside or replacing `.eq('status', 'active')` with a broader filter that also catches `expiring`/`expired` customers who might need reminders but excludes suspended ones could be useful.

The current logic only sends reminders to `active` customers expiring in 3 days. This is correct behavior — suspended customers are already excluded. No change needed.

**Recommendation**: The auto-send-reminders function already only queries customers with `status = 'active'`, so suspended customers are never included. No code change is required.

