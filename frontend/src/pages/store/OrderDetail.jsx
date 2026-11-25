import { Link, useParams, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { HiCheckCircle, HiOutlinePrinter, HiOutlineTruck } from "react-icons/hi2";
import { useAsync, useDocumentTitle } from "@store/shared";
import { ordersApi } from "../../api";
import { PageLoader, StatusBadge, ProductImage, Alert } from "@store/shared";
import OrderSummary from "../../components/store/OrderSummary";
import { RetryPayment } from "./CheckoutReturn";
import { money, dateTime, STATUS_LABEL } from "@store/shared";
import NotFound from "./NotFound";

const FLOW = ["placed", "confirmed", "processing", "shipped", "delivered"];
function progressIndex(o) {
  if (["cancelled", "refunded", "returned"].includes(o.status)) return -1;
  return { pending_payment: 0, paid: 1, confirmed: 1, processing: 2, shipped: 3, delivered: 4 }[o.status] ?? 0;
}

export default function OrderDetail() {
  const { orderNumber } = useParams();
  const [params] = useSearchParams();
  const token = params.get("t");
  const placed = params.get("placed") === "1";
  const { user } = useSelector((s) => s.auth);
  const { data: o, loading, error } = useAsync(() => ordersApi.get(orderNumber, token), [orderNumber, token]);
  useDocumentTitle(`Order ${orderNumber}`);
  if (loading) return <PageLoader />;
  if (error || !o) return <NotFound />;
  const idx = progressIndex(o);
  const eta = o.shippingMethod?.eta;

  return (
    <div className="container-x py-8 print:py-0">
      {placed && o.status !== "pending_payment" && (
        <div className="mb-8 rounded-3xl bg-gradient-to-br from-emerald-50 to-white p-8 text-center print:hidden">
          <HiCheckCircle className="mx-auto h-14 w-14 text-emerald-500" />
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Thank you for your order!</h1>
          <p className="mt-2 text-ink-soft">We’ve sent a confirmation to <b>{o.email}</b>. {eta && <>Expected delivery: <b>{eta}</b>.</>}</p>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-ink-muted">Order</div>
          <h2 className="text-2xl font-bold tracking-tight">{o.orderNumber}</h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-ink-muted">Placed {dateTime(o.createdAt)} <StatusBadge status={o.status} /> {o.paymentMethod === "cod" && <StatusBadge status={o.paymentStatus} />}</div>
        </div>
        <button onClick={() => window.print()} className="btn-outline btn-sm print:hidden"><HiOutlinePrinter /> Print invoice</button>
      </div>

      {o.status === "pending_payment" && (
        <div className="card mt-6 max-w-lg p-5 print:hidden">
          <h3 className="mb-3 font-semibold">Complete your payment</h3>
          <RetryPayment order={o} token={o.accessToken} />
        </div>
      )}

      {idx >= 0 && o.status !== "pending_payment" && (
        <ol className="mt-8 grid grid-cols-5 gap-2 print:hidden" aria-label="Order progress">
          {FLOW.map((s, i) => (
            <li key={s} className="text-center">
              <div className={`h-1.5 rounded-full ${i <= idx ? "bg-emerald-500" : "bg-gray-200"}`} />
              <div className={`mt-2 text-xs font-medium capitalize ${i <= idx ? "text-ink" : "text-ink-muted"}`}>{s}</div>
            </li>
          ))}
        </ol>
      )}
      {["cancelled", "refunded", "returned"].includes(o.status) && (
        <Alert tone="warning" className="mt-6" title={`This order was ${STATUS_LABEL[o.status].toLowerCase()}`}>
          {o.statusHistory.at(-1)?.note}
        </Alert>
      )}
      {o.trackingNumber && (
        <div className="mt-6 flex items-center gap-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
          <HiOutlineTruck className="h-5 w-5" /> {o.carrier || "Courier"} tracking number: <b className="font-mono">{o.trackingNumber}</b>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="card divide-y divide-gray-100">
            {o.items.map((i, k) => (
              <div key={k} className="flex items-center gap-4 p-4">
                <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100"><ProductImage src={i.image} alt={i.productName} /></div>
                <div className="min-w-0 flex-1">
                  {i.productSlug ? <Link to={`/products/${i.productSlug}`} className="text-sm font-medium hover:underline">{i.productName}</Link> : <span className="text-sm font-medium">{i.productName}</span>}
                  <div className="text-xs text-ink-muted">{i.variantLabel !== "Default" && `${i.variantLabel} · `}SKU {i.sku}</div>
                  <div className="text-xs text-ink-muted">{i.quantity} × {money(i.unitPrice)}</div>
                </div>
                <div className="text-sm font-semibold">{money(i.lineTotal)}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5 text-sm">
              <div className="mb-2 font-semibold">Delivery address</div>
              <address className="not-italic text-ink-soft">
                {o.shippingAddress.fullName}<br />{o.shippingAddress.line1}{o.shippingAddress.line2 && <>, {o.shippingAddress.line2}</>}<br />{o.shippingAddress.city}, {o.shippingAddress.province}<br />{o.shippingAddress.phone}
              </address>
              <div className="mt-3 text-xs text-ink-muted">{o.shippingMethod?.name} · {eta}</div>
            </div>
            <div className="card p-5 text-sm">
              <div className="mb-2 font-semibold">Timeline</div>
              <ul className="space-y-2">
                {o.statusHistory.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                    <div><div className="font-medium">{STATUS_LABEL[h.status] || h.status}</div><div className="text-xs text-ink-muted">{dateTime(h.at)}{h.note ? ` · ${h.note}` : ""}</div></div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <OrderSummary q={{ ...o, itemCount: o.items.reduce((s, i) => s + i.quantity, 0), coupon: o.couponCode ? { code: o.couponCode } : null }} title="Payment summary">
            <div className="mt-4 border-t border-gray-100 pt-4 text-xs text-ink-muted">Paid with: {{ card: "Card", wallet: "Digital wallet", bank: "Online banking", cod: "Cash on delivery" }[o.paymentMethod]}</div>
          </OrderSummary>
          {o.isGuest && !user && (
            <div className="card p-5 print:hidden">
              <div className="font-semibold">Save your details for next time</div>
              <p className="mt-1 text-sm text-ink-muted">Create an account with {o.email} to track orders and check out faster.</p>
              <Link to={`/auth/register?email=${encodeURIComponent(o.email)}`} className="btn-primary mt-4 w-full">Create account</Link>
            </div>
          )}
          <p className="text-xs text-ink-muted print:hidden">Bookmark this page to track your order. The link in your confirmation email works too.</p>
        </div>
      </div>
    </div>
  );
}
