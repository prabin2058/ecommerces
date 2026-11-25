import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { HiAdjustmentsHorizontal, HiXMark, HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { useAsync, useDocumentTitle } from "@store/shared";
import { catalogApi } from "../../api";
import ProductCard, { ProductCardSkeleton } from "../../components/store/ProductCard";
import { Pagination, EmptyState, Select, Checkbox, Alert, Button } from "@store/shared";
import { errorMessage } from "@store/shared";

const SORTS = [
  { v: "featured", l: "Featured" }, { v: "newest", l: "Newest" }, { v: "price_asc", l: "Price: low to high" },
  { v: "price_desc", l: "Price: high to low" }, { v: "name", l: "Name A–Z" },
];
const PRICES = [
  { l: "Under Rs 1,000", max: 100000 }, { l: "Rs 1,000 – 3,000", min: 100000, max: 300000 },
  { l: "Rs 3,000 – 7,000", min: 300000, max: 700000 }, { l: "Over Rs 7,000", min: 700000 },
];

export default function Shop() {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = useMemo(() => Object.fromEntries(params.entries()), [params]);
  const { data, loading, error } = useAsync(() => catalogApi.list({ limit: 12, ...query }), [params.toString()]);
  const { data: categories = [] } = useAsync(() => catalogApi.categories(), []);
  const activeCat = categories.find((c) => c.slug === query.category);
  useDocumentTitle(query.q ? `Search: ${query.q}` : activeCat?.name || "Shop all");

  const set = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next);
  };
  const brands = query.brand ? query.brand.split(",") : [];
  const toggleBrand = (b) => set({ brand: (brands.includes(b) ? brands.filter((x) => x !== b) : [...brands, b]).join(",") });
  const priceKey = `${query.minPrice || ""}-${query.maxPrice || ""}`;
  const activeFilters = [
    query.q && { k: "q", l: `“${query.q}”` },
    activeCat && { k: "category", l: activeCat.name },
    ...brands.map((b) => ({ k: "brand", l: b, brand: b })),
    (query.minPrice || query.maxPrice) && { k: "price", l: PRICES.find((p) => `${p.min || ""}-${p.max || ""}` === priceKey)?.l || "Price" },
    query.inStock && { k: "inStock", l: "In stock" },
  ].filter(Boolean);

  const filters = (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-sm font-semibold">Category</h3>
        <ul className="space-y-1 text-sm">
          <li><button onClick={() => set({ category: "" })} className={`w-full rounded-lg px-2 py-1.5 text-left ${!query.category ? "bg-gray-100 font-semibold" : "text-ink-soft hover:bg-gray-50"}`}>All products</button></li>
          {categories.filter((c) => !c.parent).map((c) => (
            <li key={c.id}>
              <button onClick={() => set({ category: c.slug })} className={`flex w-full justify-between rounded-lg px-2 py-1.5 text-left ${query.category === c.slug ? "bg-gray-100 font-semibold" : "text-ink-soft hover:bg-gray-50"}`}>
                {c.name}<span className="text-xs text-ink-muted">{c.productCount}</span>
              </button>
              {categories.filter((s) => s.parent === c.id).map((s) => (
                <button key={s.id} onClick={() => set({ category: s.slug })} className={`flex w-full justify-between rounded-lg py-1.5 pl-5 pr-2 text-left text-[13px] ${query.category === s.slug ? "bg-gray-100 font-semibold" : "text-ink-muted hover:bg-gray-50"}`}>
                  {s.name}<span className="text-xs">{s.productCount}</span>
                </button>
              ))}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold">Price</h3>
        <div className="space-y-2">
          {PRICES.map((p) => {
            const key = `${p.min || ""}-${p.max || ""}`;
            return (
              <Checkbox key={key} label={p.l} checked={priceKey === key} onChange={() => (priceKey === key ? set({ minPrice: "", maxPrice: "" }) : set({ minPrice: p.min || "", maxPrice: p.max || "" }))} />
            );
          })}
        </div>
      </div>
      {data?.facets?.brands?.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Brand</h3>
          <div className="space-y-2">
            {data.facets.brands.map((b) => <Checkbox key={b} label={b} checked={brands.includes(b)} onChange={() => toggleBrand(b)} />)}
          </div>
        </div>
      )}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Availability</h3>
        <Checkbox label="In stock only" checked={query.inStock === "true"} onChange={(e) => set({ inStock: e.target.checked ? "true" : "" })} />
      </div>
    </div>
  );

  return (
    <div className="container-x py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{query.q ? `Results for “${query.q}”` : activeCat?.name || "Shop all"}</h1>
        <p className="mt-1 text-sm text-ink-muted">{loading ? "Loading…" : `${data?.total ?? 0} product${data?.total === 1 ? "" : "s"}`}</p>
      </div>
      <div className="flex gap-10">
        <aside className="hidden w-56 shrink-0 lg:block">{filters}</aside>
        <div className="min-w-0 flex-1">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <button className="btn-outline btn-sm lg:hidden" onClick={() => setFiltersOpen(true)}>
              <HiAdjustmentsHorizontal /> Filters {activeFilters.length > 0 && `(${activeFilters.length})`}
            </button>
            {activeFilters.map((f) => (
              <button key={f.k + (f.brand || "")} onClick={() => (f.brand ? toggleBrand(f.brand) : f.k === "price" ? set({ minPrice: "", maxPrice: "" }) : set({ [f.k]: "" }))}
                className="chip bg-gray-100 py-1 text-ink-soft hover:bg-gray-200">{f.l} <HiXMark /></button>
            ))}
            {activeFilters.length > 1 && <button className="text-xs font-medium text-ink-muted hover:text-ink" onClick={() => setParams({})}>Clear all</button>}
            <div className="ml-auto w-48">
              <Select value={query.sort || "featured"} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort products" className="!py-2">
                {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </Select>
            </div>
          </div>

          {error ? (
            <Alert tone="error" title="Couldn’t load products">{errorMessage(error)}</Alert>
          ) : loading ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
          ) : !data.items.length ? (
            <EmptyState icon={HiOutlineMagnifyingGlass} title="No products match" action={<Button variant="outline" onClick={() => setParams({})}>Clear filters</Button>}>
              Try a different search or remove some filters.
            </EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3">{data.items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
              <div className="mt-12">
                <Pagination page={data.page} pages={data.pages} onChange={(page) => { set({ page }); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
              </div>
            </>
          )}
        </div>
      </div>

      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] animate-pop-in overflow-y-auto rounded-t-3xl bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Filters</h2>
              <button onClick={() => setFiltersOpen(false)} className="rounded-lg p-1.5 hover:bg-gray-100" aria-label="Close filters"><HiXMark className="h-6 w-6" /></button>
            </div>
            {filters}
            <Button className="mt-8 w-full" onClick={() => setFiltersOpen(false)}>Show {data?.total ?? ""} results</Button>
          </div>
        </div>
      )}
    </div>
  );
}
