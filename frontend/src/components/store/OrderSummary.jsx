import { money } from "@store/shared";

export default function OrderSummary({ q, children, title = "Order summary" }) {
  if (!q) return null;
  return (
    <div className="card p-5">
      <h2 className="mb-4 text-base font-semibold">{title}</h2>
      <dl className="space-y-2.5 text-sm">
        <div className="flex justify-between"><dt className="text-ink-muted">Subtotal ({q.itemCount} item{q.itemCount === 1 ? "" : "s"})</dt><dd className="tabular-nums">{money(q.subtotal)}</dd></div>
        {q.discount > 0 && (
          <div className="flex justify-between text-emerald-700"><dt>Discount {q.coupon?.code && <span className="chip ml-1 bg-emerald-50 font-mono">{q.coupon.code}</span>}</dt><dd className="tabular-nums">−{money(q.discount)}</dd></div>
        )}
        <div className="flex justify-between">
          <dt className="text-ink-muted">Shipping{q.shippingIsEstimate ? " (estimate)" : ""}{q.shippingMethod?.name ? ` · ${q.shippingMethod.name.replace(" delivery", "")}` : ""}</dt>
          <dd className="tabular-nums">{money(q.shippingFee, { free: true })}</dd>
        </div>
        <div className="flex justify-between"><dt className="text-ink-muted">VAT</dt><dd className="tabular-nums">{money(q.tax)}</dd></div>
        <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{money(q.total)}</dd></div>
      </dl>
      {children}
    </div>
  );
}
