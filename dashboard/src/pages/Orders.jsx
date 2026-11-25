import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HiOutlineMagnifyingGlass, HiOutlineShoppingCart } from "react-icons/hi2";
import { useAsync, useDebounced, useDocumentTitle } from "@store/shared";
import { adminApi } from "../api";
import { money, dateTime, STATUS_LABEL } from "@store/shared";
import { PageHeader } from "../layouts/AdminLayout";
import { Input, StatusBadge, Pagination, EmptyState, Spinner, Badge } from "@store/shared";

const TABS = ["", "pending_payment", "paid", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"];

export default function Orders() {
  useDocumentTitle("Orders");
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const dq = useDebounced(q, 300);
  const status = params.get("status") || "";
  const page = Number(params.get("page") || 1);
  const { data, loading } = useAsync(() => adminApi.orders({ status, q: dq, page, limit: 25 }), [status, dq, page]);
  const set = (patch) => {
    const n = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!("page" in patch)) n.delete("page");
    setParams(n);
  };
  return (
    <>
      <PageHeader title="Orders" description={data ? `${data.total} orders` : " "} />
      <div className="card">
        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-3 pt-3 scrollbar-none">
          {TABS.map((t) => (
            <button key={t} onClick={() => set({ status: t })} className={`whitespace-nowrap border-b-2 px-3 pb-2.5 text-sm font-medium ${status === t ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}>
              {t ? STATUS_LABEL[t] : "All"}
            </button>
          ))}
        </div>
        <div className="border-b border-gray-100 p-3">
          <div className="relative max-w-md">
            <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); set({ q: e.target.value }); }} placeholder="Order number, email, phone or name" className="pl-9" />
          </div>
        </div>
        {loading && !data ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : !data?.items.length ? (
          <EmptyState icon={HiOutlineShoppingCart} title="No orders">Orders matching this view will appear here.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                <tr><th className="px-5 py-3">Order</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3">Items</th><th className="px-5 py-3 text-right">Total</th></tr>
              </thead>
              <tbody className={`divide-y divide-gray-100 ${loading ? "opacity-60" : ""}`}>
                {data.items.map((o) => (
                  <tr key={o._id} className="hover:bg-gray-50">
                    <td className="px-5 py-3"><Link to={`/orders/${o._id}`} className="font-medium hover:underline">{o.orderNumber}</Link><div className="text-xs text-ink-muted">{dateTime(o.createdAt)}</div></td>
                    <td className="px-3 py-3"><div className="font-medium">{o.shippingAddress?.fullName}</div><div className="text-xs text-ink-muted">{o.email}{!o.user && " · guest"}</div></td>
                    <td className="px-3 py-3"><StatusBadge status={o.status} />{o.flags?.length > 0 && <Badge tone="red" className="ml-1">{o.flags[0].replaceAll("_", " ")}</Badge>}</td>
                    <td className="px-3 py-3"><span className="text-xs uppercase text-ink-muted">{o.paymentMethod}</span> <StatusBadge status={o.paymentStatus} /></td>
                    <td className="px-3 py-3 tabular-nums">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{money(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-gray-100 p-3"><Pagination page={page} pages={data?.pages} onChange={(p) => set({ page: String(p) })} /></div>
      </div>
    </>
  );
}
