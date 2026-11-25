import { useState } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useAsync, useDocumentTitle } from "@store/shared";
import { adminApi } from "../api";
import { errorMessage } from "@store/shared";
import { money, dateTime, STATUS_LABEL } from "@store/shared";
import { isAdmin } from "../redux/authSlice";
import { PageHeader } from "../layouts/AdminLayout";
import { PageLoader, StatusBadge, Button, Modal, Field, Input, Checkbox, Alert, Badge, ProductImage } from "@store/shared";

const ACTION_LABEL = { processing: "Start processing", shipped: "Mark as shipped", delivered: "Mark as delivered", cancelled: "Cancel order", refunded: "Refund", returned: "Mark as returned" };

export default function AdminOrderDetail() {
  const { id } = useParams();
  const { user } = useSelector((s) => s.auth);
  const { data: o, loading, setData } = useAsync(() => adminApi.order(id), [id]);
  const [action, setAction] = useState(null);
  const [form, setForm] = useState({ note: "", trackingNumber: "", carrier: "Pathao", restock: true });
  const [busy, setBusy] = useState(false);
  useDocumentTitle(o ? `Order ${o.orderNumber}` : "Order");
  if (loading) return <PageLoader />;
  if (!o) return <Alert tone="error">Order not found.</Alert>;

  const submit = async () => {
    setBusy(true);
    try {
      setData(await adminApi.orderStatus(id, { status: action, ...form }));
      toast.success(`Order ${STATUS_LABEL[action].toLowerCase()}`);
      setAction(null);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const a = o.shippingAddress || {};
  return (
    <>
      <PageHeader back={{ to: "/orders", label: "Orders" }} title={o.orderNumber}
        description={<span className="flex flex-wrap items-center gap-2">{dateTime(o.createdAt)} <StatusBadge status={o.status} /> <StatusBadge status={o.paymentStatus} /> {o.flags?.map((f) => <Badge key={f} tone="red">{f.replaceAll("_", " ")}</Badge>)}</span>}
        actions={isAdmin(user) ? o.allowedTransitions.map((t) => (
          <Button key={t} variant={["cancelled", "refunded"].includes(t) ? "outline" : "primary"} className={["cancelled", "refunded"].includes(t) ? "text-red-600" : ""} onClick={() => { setForm({ note: "", trackingNumber: o.trackingNumber || "", carrier: o.carrier || "Pathao", restock: true }); setAction(t); }}>
            {ACTION_LABEL[t]}
          </Button>
        )) : <span className="text-xs text-ink-muted">Only admins can change order status.</span>} />

      {o.status === "pending_payment" && <Alert tone="warning" className="mb-6" title="Awaiting payment">Stock is reserved until {dateTime(o.reservationExpiresAt)}. Unpaid orders are cancelled automatically and the stock is released.</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <div className="card">
            <div className="border-b border-gray-100 px-5 py-4 text-sm font-semibold">Items</div>
            <div className="divide-y divide-gray-100">
              {o.items.map((i) => (
                <div key={i._id} className="flex items-center gap-4 px-5 py-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100"><ProductImage src={i.image} alt="" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{i.productName}</div>
                    <div className="text-xs text-ink-muted">{i.variantLabel} · <span className="font-mono">{i.sku}</span>{i.backordered && " · backordered"}</div>
                  </div>
                  <div className="text-sm tabular-nums text-ink-muted">{i.quantity} × {money(i.unitPrice)}</div>
                  <div className="w-24 text-right text-sm font-semibold tabular-nums">{money(i.lineTotal)}</div>
                </div>
              ))}
            </div>
            <dl className="space-y-1.5 border-t border-gray-100 px-5 py-4 text-sm">
              <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd>{money(o.subtotal)}</dd></div>
              {o.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount ({o.couponCode})</dt><dd>−{money(o.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-muted">Shipping · {o.shippingMethod?.name}</dt><dd>{money(o.shippingFee, { free: true })}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-muted">VAT</dt><dd>{money(o.tax)}</dd></div>
              <div className="flex justify-between pt-1 text-base font-semibold"><dt>Total</dt><dd>{money(o.total)}</dd></div>
            </dl>
          </div>

          <div className="card">
            <div className="border-b border-gray-100 px-5 py-4 text-sm font-semibold">Payments</div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {o.payments.map((p) => (
                  <tr key={p._id}>
                    <td className="px-5 py-3"><div className="font-medium capitalize">{p.gateway} · {p.method}</div><div className="font-mono text-xs text-ink-muted">{p.gatewayRef}</div></td>
                    <td className="px-3 py-3"><Badge tone={p.status === "succeeded" ? "green" : p.status === "failed" ? "red" : p.status === "refunded" ? "yellow" : "gray"}>{p.status}</Badge>{p.failureReason && <div className="mt-1 text-xs text-red-600">{p.failureReason}</div>}</td>
                    <td className="px-3 py-3 text-xs text-ink-muted">{dateTime(p.createdAt)}</td>
                    <td className="px-5 py-3 text-right font-medium">{money(p.amount)}</td>
                  </tr>
                ))}
                {!o.payments.length && <tr><td className="px-5 py-4 text-sm text-ink-muted">{o.paymentMethod === "cod" ? "Cash on delivery — payment recorded on delivery." : "No payment attempts."}</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="card p-5">
            <div className="mb-4 text-sm font-semibold">Timeline</div>
            <ol className="relative space-y-4 border-l border-gray-200 pl-5">
              {[...o.statusHistory].reverse().map((h, i) => (
                <li key={i}>
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-gray-400" />
                  <div className="text-sm font-medium">{STATUS_LABEL[h.status] || h.status}</div>
                  <div className="text-xs text-ink-muted">{dateTime(h.at)} · {h.actor}{h.note ? ` — ${h.note}` : ""}</div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5 text-sm">
            <div className="mb-2 font-semibold">Customer</div>
            <div>{o.user ? <>{o.user.name} <span className="text-ink-muted">(account)</span></> : <span className="text-ink-muted">Guest checkout</span>}</div>
            <a href={`mailto:${o.email}`} className="link block">{o.email}</a>
            <a href={`tel:${o.phone}`} className="block text-ink-soft">{o.phone}</a>
          </div>
          <div className="card p-5 text-sm">
            <div className="mb-2 font-semibold">Ship to</div>
            <address className="not-italic text-ink-soft">{a.fullName}<br />{a.line1}{a.line2 && <>, {a.line2}</>}<br />{a.city}, {a.province}<br />{a.phone}</address>
            {o.notes && <div className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Note: {o.notes}</div>}
            {o.trackingNumber && <div className="mt-3 text-xs">Tracking: <b>{o.carrier}</b> <span className="font-mono">{o.trackingNumber}</span></div>}
          </div>
          <div className="card p-5 text-sm">
            <div className="mb-2 font-semibold">Stock</div>
            <div className="text-ink-soft">{{ reserved: "Reserved (held for payment)", committed: "Deducted from inventory", released: "Released back to inventory", none: "—" }[o.stockState]}</div>
          </div>
        </div>
      </div>

      <Modal open={!!action} onClose={() => setAction(null)} title={action ? ACTION_LABEL[action] : ""} size="sm"
        footer={<><Button variant="outline" onClick={() => setAction(null)}>Back</Button><Button variant={["cancelled", "refunded"].includes(action) ? "danger" : "primary"} loading={busy} onClick={submit}>Confirm</Button></>}>
        <div className="space-y-4">
          {action === "shipped" && (
            <>
              <Field label="Carrier"><Input value={form.carrier} onChange={(e) => setForm({ ...form, carrier: e.target.value })} /></Field>
              <Field label="Tracking number" required><Input value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} /></Field>
            </>
          )}
          {(action === "refunded" || (action === "cancelled" && o.paymentStatus === "paid")) && <Alert tone="warning">{money(o.total)} will be refunded to the customer through the payment gateway.</Alert>}
          {["cancelled", "refunded", "returned"].includes(action) && o.stockState === "committed" && <Checkbox label="Put items back in stock" checked={form.restock} onChange={(e) => setForm({ ...form, restock: e.target.checked })} />}
          <Field label="Note (optional)" hint="Saved in the order timeline"><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <p className="text-xs text-ink-muted">The customer is emailed about this change.</p>
        </div>
      </Modal>
    </>
  );
}
