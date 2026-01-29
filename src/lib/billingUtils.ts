import { differenceInDays, isBefore, isEqual, startOfDay } from "date-fns";

export type CustomerStatus = "active" | "expiring" | "expired" | "suspended";

export interface BillingInfo {
  displayDue: number;
  daysUntilBilling: number;
  status: CustomerStatus;
  statusLabel: string;
  isBillingDuePassed: boolean;
}

/**
 * Calculate the actual due amount based on billing date logic:
 * - If billing date hasn't passed yet, show 0 due (unless there's accumulated debt)
 * - If billing date has passed, show the due amount
 * - Accumulate dues across billing periods if unpaid
 */
export function calculateBillingInfo(
  expiryDate: Date,
  totalDue: number,
  currentStatus: CustomerStatus,
  monthlyPrice: number = 0
): BillingInfo {
  const today = startOfDay(new Date());
  const expiry = startOfDay(new Date(expiryDate));
  
  const daysUntilBilling = differenceInDays(expiry, today);
  const isBillingDuePassed = isBefore(expiry, today) || isEqual(expiry, today);
  
  let status: CustomerStatus = currentStatus;
  let statusLabel: string;
  let displayDue: number;
  
  // If suspended, keep that status
  if (currentStatus === "suspended") {
    status = "suspended";
    statusLabel = "Suspended";
    displayDue = totalDue;
  } else if (daysUntilBilling < 0) {
    // Billing date has passed
    const overdueDays = Math.abs(daysUntilBilling);
    status = "expired";
    
    if (overdueDays <= 30) {
      statusLabel = `Overdue ${overdueDays} day${overdueDays > 1 ? "s" : ""}`;
    } else {
      statusLabel = "Long Overdue";
    }
    
    // Show the actual due amount since billing date has passed
    displayDue = totalDue;
  } else if (daysUntilBilling === 0) {
    // Today is the billing date
    status = "expiring";
    statusLabel = "Due Today";
    displayDue = totalDue;
  } else if (daysUntilBilling <= 3) {
    // Expiring within 3 days
    status = "expiring";
    statusLabel = `Due in ${daysUntilBilling} day${daysUntilBilling > 1 ? "s" : ""}`;
    // Show 0 if no accumulated debt, otherwise show debt
    displayDue = totalDue > monthlyPrice ? totalDue - monthlyPrice : 0;
  } else {
    // Active - billing date not yet reached
    status = "active";
    statusLabel = `${daysUntilBilling} days left`;
    // Only show accumulated debt (past dues), not current cycle
    displayDue = totalDue > monthlyPrice ? totalDue - monthlyPrice : 0;
  }
  
  return {
    displayDue: Math.max(0, displayDue),
    daysUntilBilling,
    status,
    statusLabel,
    isBillingDuePassed,
  };
}

/**
 * Calculate how many billing cycles have been missed
 */
export function calculateMissedCycles(
  expiryDate: Date,
  billingStartDate: Date
): number {
  const today = startOfDay(new Date());
  const expiry = startOfDay(new Date(expiryDate));
  
  if (!isBefore(expiry, today)) {
    return 0;
  }
  
  const daysOverdue = differenceInDays(today, expiry);
  // Approximate cycles missed (assuming ~30 day cycles)
  return Math.floor(daysOverdue / 30);
}
