import { useState } from "react";
import { Link } from "react-router-dom";
import { HiOutlineArchiveBox } from "react-icons/hi2";
import { useAsync, useDocumentTitle } from "@store/shared";
import { adminApi } from "../api";
import { dateTime } from "@store/shared";
import { PageHeader } from "../layouts/AdminLayout";
import { Spinner, EmptyState, Pagination, Badge } from "@store/shared";

export default function Inventory() {
  useDocumentTitle("Inventory");
  const { data: low, loading } = useAsync(() => adminApi.lowStock(), []);
  const [page, setPage] = useState(1);
  const { data: logs } = useAsync(() => adminApi.inventoryLogs({ page, limit: 30 }), [page]);
  return (
    <>
      <PageHeader title="Inventory" description="Stock is tracked per variant: available = on hand − reserved." />
      <div className="card mb-6">
        <div className="border-b border-gray-100 px-5 py-4 text-sm font-semibold">Low & out of stock</div>
        {loading ? <div className="flex justify-center py-10"><Spinner /></div> : !low?.length ? (
          <EmptyState icon={HiOutlineArchiveBox} title="Everything is well stocked" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-5 py-2">Product</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">On hand</th><th className="px-3 py-2">Reserved</th><th className="px-3 py-2">Available</th><th className="px-3 py-2">Alert at</th><th /></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {low.map((v) => (
                  <tr key={v.id}>
                    <td className="px-5 py-2.5"><div className="font-medium">{v.product?.name}</div><div className="text-xs text-ink-muted">{v.label}</div></td>
                    <td className="px-3 py-2.5 font-mono text-xs">{v.sku}</td>
                    <td className="px-3 py-2.5 tabular-nums">{v.onHand}</td>
                    <td className="px-3 py-2.5 tabular-nums">{v.reserved}</td>
                    <td className="px-3 py-2.5">{v.available <= 0 ? <Badge tone="red">Out</Badge> : <Badge tone="yellow">{v.available} left</Badge>}</td>
                    <td className="px-3 py-2.5 tabular-nums text-ink-muted">{v.threshold}</td>
                    <td className="px-5 py-2.5 text-right"><Link to={`/products/${v.product?._id}`} className="btn-outline btn-sm">Restock</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="card">
        <div className="border-b border-gray-100 px-5 py-4 text-sm font-semibold">Stock movements</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-5 py-2">When</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Change</th><th className="px-3 py-2">After</th><th className="px-3 py-2">Reason</th><th className="px-3 py-2">Reference</th><th className="px-5 py-2">By</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {logs?.items.map((l) => (
                <tr key={l._id}>
                  <td className="whitespace-nowrap px-5 py-2 text-xs text-ink-muted">{dateTime(l.createdAt)}</td>
                  <td className="px-3 py-2 font-mono text-xs">{l.sku}</td>
                  <td className={`px-3 py-2 font-semibold tabular-nums ${l.change > 0 ? "text-emerald-600" : "text-red-600"}`}>{l.change > 0 ? "+" : ""}{l.change} <span className="text-xs font-normal text-ink-muted">{l.field === "reserved" ? "reserved" : "on hand"}</span></td>
                  <td className="px-3 py-2 tabular-nums">{l.after}</td>
                  <td className="px-3 py-2 capitalize">{l.reason.replace("_", " ")}</td>
                  <td className="px-3 py-2 text-xs text-ink-muted">{l.refId || l.note || "—"}</td>
                  <td className="px-5 py-2 text-xs">{l.user?.name || "system"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-gray-100 p-3"><Pagination page={page} pages={logs?.pages} onChange={setPage} /></div>
      </div>
    </>
  );
}
