import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely — use everywhere instead of raw clsx */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a Decimal/number as USD currency */
export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/** Format a date for display */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

/** Format a date with time */
export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

/** Slugify a string */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Generate a human-readable order number */
export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `BB-${timestamp}-${random}`;
}

/** Carrier display labels */
export const CARRIER_LABELS: Record<string, string> = {
  UNLOCKED: "Unlocked",
  ATT: "AT&T",
  TMOBILE: "T-Mobile",
  VERIZON: "Verizon",
  SPRINT: "Sprint",
  OTHER: "Other",
};

/** Payout method display labels */
export const PAYOUT_LABELS: Record<string, string> = {
  PAYPAL: "PayPal",
  ZELLE: "Zelle",
  VENMO: "Venmo",
  CHECK: "Check",
  ACH: "Bank Transfer (ACH)",
  STORE_CREDIT: "Store Credit",
};

/** Order status display config */
export const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  PENDING: { label: "Pending shipment", color: "bg-yellow-100 text-yellow-800" },
  SHIPPED: { label: "Shipped", color: "bg-blue-100 text-blue-800" },
  RECEIVED: { label: "Received", color: "bg-indigo-100 text-indigo-800" },
  INSPECTING: { label: "Inspecting", color: "bg-purple-100 text-purple-800" },
  OFFER_REVISED: { label: "Offer revised", color: "bg-orange-100 text-orange-800" },
  APPROVED: { label: "Approved", color: "bg-teal-100 text-teal-800" },
  PAID: { label: "Paid", color: "bg-green-100 text-green-800" },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800" },
  RETURNED: { label: "Returned", color: "bg-gray-100 text-gray-800" },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-500" },
};

/** Truncate a string to a max length with ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/** Sleep for n milliseconds — use in retry loops */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
