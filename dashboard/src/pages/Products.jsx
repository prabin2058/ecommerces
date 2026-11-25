import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { HiOutlineMagnifyingGlass, HiOutlineDocumentDuplicate, HiOutlinePencilSquare, HiOutlineCube } from "react-icons/hi2";
import { useAsync, useDebounced, useDocumentTitle } from "@store/shared";
import { adminApi } from "../api";
import { errorMessage } from "@store/shared";
import { money, dateTime, sized } from "@store/shared";
import { isAdmin } from "../redux/authSlice";
import { PageHeader } from "../layouts/AdminLayout";
import { Button, Input, Select, StatusBadge, Pagination, EmptyState, Modal, Field, Spinner, Badge } from "@store/shared";

export default function Products() {
  useDocumentTitle("Products");
  const { user } = useSelector((s) => s.auth);
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const dq = useDebounced(q, 300);
  const query = { status: params.get("status") || "", category: params.get("category") || "", stock: params.get("stock") || "", sort: params.get("sort") || "-updatedAt", page: Number(params.get("page") || 1), q: dq };
  const { data, loading, reload } = useAsync(() => adminApi.products({ ...query, limit: 20 }), [JSON.stringify(query)]);
  const { data: cats = [] } = useAsync(() => adminApi.categories(), []);
  const [selected, setSelected] = useState(new Set());
  const [bulk, setBulk] = useState(null);
  const [bulkValue, setBulkValue] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const set = (patch) => {
    const n = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!("page" in patch)) n.delete("page");
    setParams(n);
    setSelected(new Set());
  };
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = data?.items?.length && data.items.every((p) => selected.has(p.id));

  const runBulk = async (action, value) => {
    setBusy(true);
    try {
      const r = await adminApi.bulk({ ids: [...selected], action, value });
      if (r.failed) {
        const first = r.results.find((x) => !x.ok);
        toast.warn(`${r.succeeded} updated, ${r.failed} failed: ${first.details?.publish?.[0] || first.error}`, { autoClose: 6000 });
      } else toast.success(`${r.succeeded} product(s) updated`);
      setSelected(new Set());
      setBulk(null);
      setBulkValue("");
      reload({ silent: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const duplicate = async (id) => {
    try {
      const p = await adminApi.duplicate(id);
      toast.success("Duplicated as draft");
      navigate(`/products/${p.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader title="Products" description={data ? `${data.total} products` : " "} actions={<><Link to="/import" className="btn-outline">Import / export</Link><Link to="/products/new" className="btn-primary">Add product</Link></>} />
      <div className="card">
        <div className="flex flex-wrap gap-2 border-b border-gray-100 p-3">
          <div className="relative min-w-56 flex-1">
            <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); set({ q: e.target.value }); }} placeholder="Search name, brand or SKU" className="pl-9" />
          </div>
          <Select className="!w-auto" value={query.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status filter">
            <option value="">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="archived">Archived</option>
          </Select>
          <Select className="!w-auto" value={query.category} onChange={(e) => set({ category: e.target.value })} aria-label="Category filter">
            <option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.parent ? "— " : ""}{c.name}</option>)}
          </Select>
          <Select className="!w-auto" value={query.stock} onChange={(e) => set({ stock: e.target.value })} aria-label="Stock filter">
            <option value="">Any stock</option><option value="low">Low stock</option><option value="out">Out of stock</option>
          </Select>
          <Select className="!w-auto" value={query.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort">
            <option value="-updatedAt">Recently updated</option><option value="-createdAt">Newest</option><option value="name">Name A–Z</option><option value="price">Price ↑</option><option value="-price">Price ↓</option>
          </Select>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-brand-50 px-4 py-2.5 text-sm">
            <span className="font-semibold">{selected.size} selected</span>
            <Button size="sm" variant="outline" loading={busy} onClick={() => runBulk("publish")}>Publish</Button>
            <Button size="sm" variant="outline" loading={busy} onClick={() => runBulk("draft")}>Unpublish</Button>
            <Button size="sm" variant="outline" loading={busy} onClick={() => runBulk("archive")}>Archive</Button>
            <Button size="sm" variant="outline" onClick={() => setBulk("set_category")}>Change category</Button>
            {isAdmin(user) && <Button size="sm" variant="outline" onClick={() => setBulk("adjust_price")}>Adjust price %</Button>}
            <button className="ml-auto text-xs text-ink-muted hover:text-ink" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        {loading && !data ? (
          <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
        ) : !data?.items.length ? (
          <EmptyState icon={HiOutlineCube} title="No products found" action={<Link to="/products/new" className="btn-primary">Add product</Link>}>Try another filter or create your first product.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/60 text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Select all" checked={!!allOnPage} onChange={() => setSelected(allOnPage ? new Set() : new Set(data.items.map((p) => p.id)))} className="rounded border-gray-300" /></th>
                  <th className="px-2 py-3">Product</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Stock</th><th className="px-3 py-3">Price</th><th className="hidden px-3 py-3 lg:table-cell">Category</th><th className="hidden px-3 py-3 xl:table-cell">Updated</th><th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className={`divide-y divide-gray-100 ${loading ? "opacity-60" : ""}`}>
                {data.items.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="rounded border-gray-300" /></td>
                    <td className="px-2 py-3">
                      <Link to={`/products/${p.id}`} className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-100">{p.image && <img src={sized(p.image, 120)} alt="" className="h-full w-full object-cover" />}</div>
                        <div className="min-w-0"><div className="truncate font-medium hover:underline">{p.name}</div><div className="text-xs text-ink-muted">{p.variantCount} variant{p.variantCount === 1 ? "" : "s"}{p.brand && ` · ${p.brand}`}</div></div>
                      </Link>
                    </td>
                    <td className="px-3 py-3">{p.status === "draft" && p.publishAt ? <Badge tone="blue">Scheduled {dateTime(p.publishAt)}</Badge> : <StatusBadge status={p.status} />}</td>
                    <td className="px-3 py-3"><span className={`font-medium tabular-nums ${p.stock <= 0 ? "text-red-600" : p.lowStock ? "text-amber-600" : ""}`}>{p.stock}</span> <span className="text-xs text-ink-muted">available</span></td>
                    <td className="px-3 py-3 tabular-nums">{money(p.priceMin)}{p.priceMax !== p.priceMin && ` – ${money(p.priceMax)}`}</td>
                    <td className="hidden px-3 py-3 text-ink-soft lg:table-cell">{p.categories.join(", ") || <span className="text-red-500">None</span>}</td>
                    <td className="hidden px-3 py-3 text-xs text-ink-muted xl:table-cell">{dateTime(p.updatedAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link to={`/products/${p.id}`} className="btn-ghost btn-sm" aria-label="Edit"><HiOutlinePencilSquare className="h-4 w-4" /></Link>
                      <button className="btn-ghost btn-sm" onClick={() => duplicate(p.id)} aria-label="Duplicate" title="Duplicate"><HiOutlineDocumentDuplicate className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-gray-100 p-3"><Pagination page={data?.page || 1} pages={data?.pages} onChange={(page) => set({ page: String(page) })} /></div>
      </div>

      <Modal open={!!bulk} onClose={() => setBulk(null)} title={bulk === "adjust_price" ? "Adjust prices" : "Change category"} size="sm"
        footer={<><Button variant="outline" onClick={() => setBulk(null)}>Cancel</Button><Button loading={busy} disabled={!bulkValue} onClick={() => runBulk(bulk, bulkValue)}>Apply to {selected.size}</Button></>}>
        {bulk === "adjust_price" ? (
          <Field label="Change by %" hint="Use a negative number for a markdown, e.g. -10. Applies to every variant; prices are rounded to the nearest rupee.">
            <Input type="number" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder="10" />
          </Field>
        ) : (
          <Field label="Category" hint="Replaces the current categories of the selected products.">
            <Select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}><option value="">Choose…</option>{cats.filter((c) => c.isActive).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </Field>
        )}
      </Modal>
    </>
  );
}
