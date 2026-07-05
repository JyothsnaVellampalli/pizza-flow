// src/lib/core.ts

export interface ValidationResult {
  ok: boolean;
  value?: string | number;
  error?: string;
}

export function validateName(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'Name cannot be blank.' };
  if (!/^[a-zA-Z\s]+$/.test(trimmed)) return { ok: false, error: 'Name must contain letters and spaces only.' };
  if (trimmed.length < 2) return { ok: false, error: 'Name must be at least 2 characters.' };
  if (trimmed.length > 40) return { ok: false, error: 'Name must be 40 characters or less.' };
  return { ok: true, value: trimmed };
}

export function validatePhone(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!/^\d{10}$/.test(trimmed)) return { ok: false, error: 'Phone must be exactly 10 digits.' };
  if (!['6','7','8','9'].includes(trimmed[0])) return { ok: false, error: 'Phone must start with 6, 7, 8, or 9.' };
  return { ok: true, value: trimmed };
}

export function validateQuantity(input: string): ValidationResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'Please enter a quantity.' };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: 'Quantity must be a whole number (e.g. 2, not "two" or 2.5).' };
  const n = parseInt(trimmed, 10);
  if (n < 1) return { ok: false, error: 'Minimum quantity is 1.' };
  if (n > 10) return { ok: false, error: 'Maximum 10 pizzas per order.' };
  return { ok: true, value: n };
}

export interface PricingResult {
  unitPrice: number;
  subtotal: number;
  discount: number;
  taxableAmount: number;
  gst: number;
  totalPayable: number;
}

// These constants are the single place to change discount/GST rules
export const DISCOUNT_THRESHOLD = 5;
export const DISCOUNT_RATE = 0.10;
export const GST_RATE = 0.18;

export function calculatePricing(
  basePrice: number,
  pizzaPrice: number,
  toppingPrice: number,
  quantity: number
): PricingResult {
  const unitPrice = basePrice + pizzaPrice + toppingPrice;
  const subtotal = unitPrice * quantity;
  const discount = quantity >= DISCOUNT_THRESHOLD ? subtotal * DISCOUNT_RATE : 0;
  const taxableAmount = subtotal - discount;
  const gst = taxableAmount * GST_RATE;
  const totalPayable = taxableAmount + gst;
  return { unitPrice, subtotal, discount, taxableAmount, gst, totalPayable };
}
