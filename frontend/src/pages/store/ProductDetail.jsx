import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { HiOutlineTruck, HiOutlineArrowPath, HiOutlineShieldCheck, HiChevronRight, HiCheck } from "react-icons/hi2";
import { useAsync, sized, srcSetFor } from "@store/shared";
import { catalogApi } from "../../api";
import { addToCart } from "../../redux/cart/cartSlice";
import { Button, Price, QuantityStepper, PageLoader, EmptyState, Badge } from "@store/shared";
import ProductCard from "../../components/store/ProductCard";
import NotFound from "./NotFound";

function Gallery({ images, activeVariantId, name }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const i = images.findIndex((im) => im.variant && im.variant === activeVariantId);
    if (i >= 0) setIdx(i);
  }, [activeVariantId, images]);
  const current = images[idx] || images[0];
  return (
    <div className="flex flex-col-reverse gap-3 md:flex-row">
      {images.length > 1 && (
        <div className="flex gap-3 overflow-x-auto scrollbar-none md:w-20 md:flex-col">
          {images.map((im, i) => (
            <button key={im.id} onClick={() => setIdx(i)} aria-label={`Show image ${i + 1}`}
              className={`aspect-square w-20 shrink-0 overflow-hidden rounded-xl border-2 ${i === idx ? "border-ink" : "border-transparent opacity-70 hover:opacity-100"}`}>
              <img src={sized(im.url, 200)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="aspect-square flex-1 overflow-hidden rounded-3xl bg-gray-100">
        {current ? <img src={current.url} srcSet={srcSetFor(current.url)} sizes="(min-width: 1024px) 50vw, 100vw" alt={current.altText || name} className="h-full w-full object-cover" /> : null}
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const { data: p, loading, error } = useAsync(() => catalogApi.bySlug(slug), [slug]);
  const { data: related } = useAsync(
    () => (p ? catalogApi.list({ category: p.categories[0]?.slug, exclude: p.id, limit: 4 }) : Promise.resolve(null)),
    [p?.id]
  );
  const dispatch = useDispatch();
  const pending = useSelector((s) => s.cart.pending > 0);
  const cartQty = useSelector((s) => s.cart.data?.items || []);
  const [selected, setSelected] = useState({});
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  // Default selection: first in-stock variant.
  useEffect(() => {
    if (!p) return;
    const first = p.variants.find((v) => v.inStock) || p.variants[0];
    setSelected(first ? { ...first.options } : {});
    setQty(1);
    document.title = `${p.seoTitle} · Prabin Store`;
    document.querySelector('meta[name="description"]')?.setAttribute("content", p.seoDescription);
  }, [p]);

  const variant = useMemo(() => {
    if (!p) return null;
    if (!p.options.length) return p.variants[0];
    return p.variants.find((v) => p.options.every((o) => v.options[o.name] === selected[o.name])) || null;
  }, [p, selected]);

  if (loading) return <PageLoader />;
  if (error?.response?.status === 404) return <NotFound />;
  if (error || !p) return <EmptyState title="Couldn’t load this product">Please refresh the page.</EmptyState>;

  // Is a value selectable given the other current selections?
  const valueState = (optName, value) => {
    const candidate = { ...selected, [optName]: value };
    const matches = p.variants.filter((v) => Object.entries(candidate).every(([k, val]) => !val || v.options[k] === val));
    if (!matches.length) return "none";
    return matches.some((v) => v.inStock) ? "ok" : "out";
  };

  const inCart = variant ? cartQty.find((i) => i.variantId === variant.id)?.quantity || 0 : 0;
  const maxQty = variant ? Math.max(1, Math.min(10 - inCart, variant.available ?? 10)) : 1;
  const canAdd = variant && variant.inStock && inCart < 10 && (variant.available === null || inCart < variant.available);

  const add = async () => {
    setAdding(true);
    const r = await dispatch(addToCart({ variantId: variant.id, quantity: qty }));
    setAdding(false);
    if (r.error) toast.error(r.payload?.message || "Could not add to cart");
    else setQty(1);
  };

  return (
    <div className="container-x py-6">
      <nav className="mb-6 flex items-center gap-1 text-xs text-ink-muted" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-ink">Home</Link><HiChevronRight />
        <Link to="/products" className="hover:text-ink">Shop</Link>
        {p.categories[0] && (<><HiChevronRight /><Link to={`/products?category=${p.categories[0].slug}`} className="hover:text-ink">{p.categories[0].name}</Link></>)}
        <HiChevronRight /><span className="truncate text-ink-soft">{p.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <Gallery images={p.images} activeVariantId={variant?.id} name={p.name} />

        <div className="lg:py-2">
          {p.brand && <div className="text-sm font-semibold uppercase tracking-wide text-brand-600">{p.brand}</div>}
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{p.name}</h1>
          <div className="mt-4">
            {variant ? <Price price={variant.price} compareAt={variant.compareAtPrice} size="lg" /> : <Price price={p.priceMin} size="lg" />}
            <p className="mt-1 text-xs text-ink-muted">{p.taxClass === "exempt" ? "Tax exempt" : `+ ${p.taxClass === "reduced" ? "5%" : "13%"} VAT at checkout`}</p>
          </div>

          <div className="mt-6 space-y-5">
            {p.options.map((o) => (
              <fieldset key={o.name}>
                <legend className="mb-2 text-sm font-medium">{o.name}: <span className="font-normal text-ink-muted">{selected[o.name] || "Choose"}</span></legend>
                <div className="flex flex-wrap gap-2">
                  {o.values.map((val) => {
                    const st = valueState(o.name, val);
                    const active = selected[o.name] === val;
                    return (
                      <button key={val} disabled={st === "none"} onClick={() => setSelected({ ...selected, [o.name]: val })} aria-pressed={active}
                        className={`relative min-w-12 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${active ? "border-ink bg-ink text-white" : "border-gray-300 hover:border-ink"} ${st === "out" && !active ? "text-ink-muted line-through decoration-gray-400" : ""} disabled:cursor-not-allowed disabled:opacity-30`}>
                        {val}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <div className="mt-6 text-sm">
            {!variant ? (
              <span className="text-ink-muted">This combination isn’t available.</span>
            ) : variant.stockLevel === "out" ? (
              <Badge tone="gray">Out of stock</Badge>
            ) : variant.stockLevel === "low" ? (
              <span className="font-medium text-amber-700">Only {variant.available} left — order soon</span>
            ) : variant.stockLevel === "backorder" ? (
              <span className="font-medium text-amber-700">Available on backorder — ships when restocked</span>
            ) : (
              <span className="flex items-center gap-1.5 font-medium text-emerald-700"><HiCheck /> In stock, ready to ship</span>
            )}
          </div>

          <div className="mt-4 flex gap-3">
            <QuantityStepper value={Math.min(qty, maxQty)} onChange={setQty} max={maxQty} disabled={!canAdd} />
            <Button size="lg" className="flex-1" onClick={add} loading={adding} disabled={!canAdd || pending}>
              {!variant ? "Select options" : !variant.inStock ? "Sold out" : !canAdd ? "Max in cart" : "Add to cart"}
            </Button>
          </div>
          {inCart > 0 && <p className="mt-2 text-xs text-ink-muted">{inCart} already in your cart</p>}

          <div className="mt-8 grid gap-3 rounded-2xl border border-gray-200 p-4 text-sm sm:grid-cols-3">
            <div className="flex items-center gap-2"><HiOutlineTruck className="h-5 w-5 text-ink-muted" /> Free over Rs 5,000</div>
            <div className="flex items-center gap-2"><HiOutlineArrowPath className="h-5 w-5 text-ink-muted" /> 7-day returns</div>
            <div className="flex items-center gap-2"><HiOutlineShieldCheck className="h-5 w-5 text-ink-muted" /> Secure checkout</div>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-6">
            <h2 className="mb-3 text-sm font-semibold">Description</h2>
            {/* Description HTML is sanitized on the server before storage. */}
            <div className="prose-product text-sm" dangerouslySetInnerHTML={{ __html: p.description }} />
            {variant && <p className="mt-4 text-xs text-ink-muted">SKU: {variant.sku}</p>}
          </div>
        </div>
      </div>

      {related?.items?.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">You may also like</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">{related.items.map((r) => <ProductCard key={r.id} product={r} />)}</div>
        </section>
      )}
    </div>
  );
}
