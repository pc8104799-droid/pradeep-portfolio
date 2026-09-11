/**
 * Every amount the app displays is computed here.
 *
 * The client never sends a total. It sends what was chosen — a doctor, a coupon,
 * a basket — and the server prices it. That is why the review step, the payment
 * screen and the receipt can never disagree with each other, and why a tampered
 * request cannot buy a consultation for ₹1.
 */

/** Consultation: fee, 5% hospital service charge, 18% GST, insurance share. */
export function billFor(fee, insuranceProvider, discount = 0) {
  const serviceCharge = Math.round(fee * 0.05);
  const taxable = Math.max(0, fee + serviceCharge - discount);
  const tax = Math.round(taxable * 0.18);

  // A covered patient pays the 40% co-pay; the insurer is billed the rest.
  const insurance = insuranceProvider ? Math.round((taxable + tax) * 0.4) : 0;

  return {
    fee,
    serviceCharge,
    discount,
    tax,
    insurance,
    total: Math.max(0, taxable + tax - insurance),
  };
}

/** Pharmacy: 5% GST on medicines, delivery free over ₹499. */
export function orderBill(itemsTotal, discount = 0) {
  const delivery = itemsTotal >= 499 ? 0 : 49;
  const taxable = Math.max(0, itemsTotal - discount);
  const tax = Math.round(taxable * 0.05);

  return {
    itemsTotal,
    discount,
    delivery,
    tax,
    total: taxable + tax + delivery,
  };
}

/**
 * Prices a coupon against a subtotal. Returns 0 rather than throwing when the
 * code does not apply, so callers can price optimistically and report the
 * reason separately.
 */
export function discountFor(coupon, subtotal) {
  if (!coupon || subtotal < (coupon.minOrder ?? 0)) return 0;

  if (coupon.flat) return Math.min(coupon.flat, subtotal);

  const percent = Math.round((subtotal * coupon.percent) / 100);
  return Math.min(percent, coupon.maxDiscount ?? percent);
}
