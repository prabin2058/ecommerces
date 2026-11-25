import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { HiOutlineShoppingBag, HiOutlineTag, HiXMark, HiOutlineLockClosed } from "react-icons/hi2";
import { applyCoupon, removeCoupon, moveToCart, removeSaved } from "../../redux/cart/cartSlice";
import { useDocumentTitle } from "@store/shared";
import { Button, EmptyState, Input, PageLoader, Alert, ProductImage } from "@store/shared";
import CartLine from "../../components/store/CartLine";
import FreeShippingBar from "../../components/store/FreeShippingBar";
import OrderSummary from "../../components/store/OrderSummary";
import { money } from "@store/shared";

function CouponForm({ cart }) {
  const dispatch = useDispatch();
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const r = await dispatch(applyCoupon(code.trim()));
    setBusy(false);
    if (r.error) setError(r.payload?.message);
    else {
      setError(null);
      setCode("");
      toast.success("Coupon applied");
    }
  };
  if (cart.coupon?.code)
    return (
      <div className="mt-4">
        <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm ${cart.coupon.error ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
          <span className="flex items-center gap-2 font-medium"><HiOutlineTag /> <span className="font-mono">{cart.coupon.code}</span></span>
          <button onClick={() => dispatch(removeCoupon())} className="rounded p-1 hover:bg-white/60" aria-label="Remove coupon"><HiXMark /></button>
        </div>
        {cart.coupon.error ? <p className="mt-1.5 text-xs font-medium text-red-600">{cart.coupon.error} Remove it to continue.</p> : cart.coupon.description && <p className="mt-1.5 text-xs text-emerald-700">{cart.coupon.description}</p>}
      </div>
    );
  return (
    <form onSubmit={submit} className="mt-4">
      <label htmlFor="coupon" className="label">Coupon code</label>
      <div className="flex gap-2">
        <Input id="coupon" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }} placeholder="e.g. WELCOME10" error={error} className="font-mono uppercase" />
        <Button variant="outline" loading={busy} type="submit">Apply</Button>
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </form>
  );
}

export default function Cart() {
  useDocumentTitle("Your cart");
  const { data: cart, loaded, pending } = useSelector((s) => s.cart);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  if (!loaded && !cart) return <PageLoader />;
  const items = cart?.items || [];
  const blocked = items.filter((i) => i.blocking).length;

  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-bold tracking-tight">Your cart</h1>
      {items.length === 0 ? (
        <EmptyState icon={HiOutlineShoppingBag} title="Your cart is empty" action={<Link to="/products" className="btn-primary">Continue shopping</Link>}>
          Items you add will appear here.
        </EmptyState>
      ) : (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <FreeShippingBar freeShipping={cart.freeShipping} />
            {blocked > 0 && (
              <Alert tone="warning" className="mt-4" title={`${blocked} item${blocked > 1 ? "s need" : " needs"} your attention`}>
                Prices or stock changed since you added {blocked > 1 ? "them" : "it"}. Review below before checking out.
              </Alert>
            )}
            {cart.issues?.map((i) => <Alert key={i.code} tone="error" className="mt-4">{i.message}</Alert>)}
            <div className="divide-y divide-gray-200 border-b border-gray-200">
              {items.map((i) => <CartLine key={i.id} item={i} />)}
            </div>
            <Link to="/products" className="link mt-4 inline-block text-sm">← Continue shopping</Link>

            {cart.saved?.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-4 text-lg font-semibold">Saved for later ({cart.saved.length})</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {cart.saved.map((s) => (
                    <div key={s.variantId} className="card flex gap-3 p-3">
                      <Link to={`/products/${s.slug}`} className="h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-gray-100"><ProductImage src={s.image} alt={s.name} /></Link>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{s.name}</div>
                        <div className="text-xs text-ink-muted">{s.options}</div>
                        <div className="mt-1 text-sm font-semibold">{money(s.price)}</div>
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" variant="outline" disabled={!s.available} onClick={async () => { const r = await dispatch(moveToCart(s.variantId)); if (r.error) toast.error(r.payload?.message); }}>
                            {s.available ? "Move to cart" : "Out of stock"}
                          </Button>
                          <button className="btn-ghost btn-sm" onClick={() => dispatch(removeSaved(s.variantId))}>Remove</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="lg:sticky lg:top-28 lg:self-start">
            <OrderSummary q={cart}>
              <CouponForm cart={cart} />
              <Button size="lg" className="mt-5 w-full" disabled={!cart.canCheckout || pending > 0} onClick={() => navigate("/checkout")}>
                <HiOutlineLockClosed /> Proceed to checkout
              </Button>
              {!cart.canCheckout && <p className="mt-2 text-center text-xs font-medium text-red-600">Resolve the issues above to continue.</p>}
              <p className="mt-3 text-center text-xs text-ink-muted">Guest checkout available · Card, wallet, bank transfer or cash on delivery</p>
            </OrderSummary>
          </div>
        </div>
      )}
    </div>
  );
}
