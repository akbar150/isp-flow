

# Add Customer Search to Ticket and Service Task Dialogs

## Overview
Replace the plain customer dropdown (Select) with a searchable customer picker in both the "Create Support Ticket" and "Create Service Task" dialogs. This allows users to quickly find customers by typing their name or User ID.

## Approach
Use a Popover + Command (cmdk) combo -- already available in the project via `@/components/ui/command` and `@/components/ui/popover`. This gives a searchable dropdown with filtering built-in.

## Changes

### 1. `src/pages/Tickets.tsx` (lines ~341-350)
- Replace the `Select` for customer with a `Popover` containing a `Command` input
- Users can type to search/filter customers by name or user ID
- Selected customer shows as "Name (UserID)" in the trigger button

### 2. `src/pages/ServiceTasks.tsx` (lines ~291-301)
- Same change: replace customer `Select` with searchable `Popover + Command`
- Same search/filter behavior

### Technical Details

New imports for both files:
- `Popover, PopoverContent, PopoverTrigger` from `@/components/ui/popover`
- `Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList` from `@/components/ui/command`
- `Check, ChevronsUpDown` from `lucide-react`

Component structure:
```
Popover
  PopoverTrigger (button showing selected customer or "Select customer")
  PopoverContent
    Command
      CommandInput (search box)
      CommandList
        CommandEmpty ("No customer found")
        CommandGroup
          CommandItem (for each customer, filterable by name + user_id)
```

Adds a local `customerSearchOpen` state (boolean) per dialog to control the popover.

