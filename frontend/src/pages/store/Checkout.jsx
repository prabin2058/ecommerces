import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { HiCheck, HiOutlineLockClosed, HiOutlineCreditCard, HiOutlineDevicePhoneMobile, HiOutlineBuildingLibrary, HiOutlineBanknotes, HiPencil } from "react-icons/hi2";
import { checkoutApi, accountApi } from "../../api";
import { errorMessage, errorCode, errorDetails } from "@store/shared";
import { fetchCart } from "../../redux/cart/cartSlice";
import { useAsync, useDocumentTitle } from "@store/shared";
import { money, uuid } from "@store/shared";
import { Button, Field, Input, Select, Checkbox, Alert, PageLoader, ProductImage, EmptyState } from "@store/shared";
import OrderSummary from "../../components/store/OrderSummary";

const PROVINCES = ["Koshi", "Madhesh", "Bagmati", "Gandaki", "Lumbini", "Karnali", "Sudurpashchim"];
const PHONE_RE = /^(\+?977[- ]?)?(9[678]\d{8}|0\d{1,2}[- ]?\d{6,7})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMPTY_ADDR = { fullName: "", phone: "", line1: "", line2: "", city: "", province: "Bagmati", postalCode: "" };
const PAYMENTS = [
  { v: "card", l: "Credit / debit card", d: "Visa, Mastercard — via secure hosted page", icon: HiOutlineCreditCard },
  { v: "wallet", l: "Digital wallet", d: "eSewa, Khalti, IME Pay", icon: HiOutlineDevicePhoneMobile },
  { v: "bank", l: "Online banking", d: "ConnectIPS / mobile banking", icon: HiOutlineBuildingLibrary },
  { v: "cod", l: "Cash on delivery", d: "Pay when your order arrives (up to Rs 50,000)", icon: HiOutlineBanknotes },
];
const DRAFT_KEY = "checkout_draft";
const IDEM_KEY = "checkout_idempotency_key";
const store = {
  get: (k, d) => { try { return JSON.parse(sessionStorage.getItem(k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
};

function validateAddress(a, contact) {
  const e = {};
  if (contact) {
    if (!EMAIL_RE.test(contact.email || "")) e.email = "Enter a valid email address";
  }
  if (!a.fullName.trim()) e.fullName = "Full name is required";
  if (!PHONE_RE.test((a.phone || "").replace(/\s/g, ""))) e.phone = "Enter a valid phone (e.g. 98XXXXXXXX)";
  if (!a.line1.trim()) e.line1 = "Street address is required";
  if (!a.city.trim()) e.city = "City is required";
  return e;
}

function AddressFields({ value, onChange, errors = {}, prefix = "" }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" error={errors.fullName} required><Input autoComplete={`${prefix}name`} value={value.fullName} onChange={set("fullName")} error={errors.fullName} /></Field>
      <Field label="Phone" error={errors.phone} required hint="For delivery updates"><Input type="tel" inputMode="tel" autoComplete={`${prefix}tel`} placeholder="98XXXXXXXX" value={value.phone} onChange={set("phone")} error={errors.phone} /></Field>
      <Field label="Street address" error={errors.line1} required className="sm:col-span-2"><Input autoComplete={`${prefix}address-line1`} placeholder="House no., street, tole" value={value.line1} onChange={set("line1")} error={errors.line1} /></Field>
      <Field label="Landmark / apartment (optional)" className="sm:col-span-2"><Input autoComplete={`${prefix}address-line2`} value={value.line2} onChange={set("line2")} /></Field>
      <Field label="City" error={errors.city} required><Input autoComplete={`${prefix}address-level2`} placeholder="Kathmandu" value={value.city} onChange={set("city")} error={errors.city} /></Field>
      <Field label="Province">
        <Select value={value.province} onChange={set("province")} autoComplete={`${prefix}address-level1`}>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</Select>
      </Field>
    </div>
  );
}

function Step({ n, title, active, done, onEdit, summary, children }) {
  return (
    <section className={`card scroll-mt-28 overflow-hidden ${active ? "ring-1 ring-ink/10" : ""}`} aria-current={active ? "step" : undefined}>
      <div className="flex items-center gap-3 px-5 py-4">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-600 text-white" : active ? "bg-ink text-white" : "bg-gray-100 text-ink-muted"}`}>{done ? <HiCheck /> : n}</span>
        <h2 className={`flex-1 font-semibold ${active || done ? "" : "text-ink-muted"}`}>{title}</h2>
        {done && !active && onEdit && <button onClick={onEdit} className="btn-ghost btn-sm"><HiPencil /> Edit</button>}
      </div>
      {done && !active && summary && <div className="px-5 pb-4 pl-15 text-sm text-ink-soft" style={{ paddingLeft: "3.75rem" }}>{summary}</div>}
      {active && <div className="border-t border-gray-100 px-5 py-5">{children}</div>}
    </section>
  );
}

export default function Checkout() {
  useDocumentTitle("Checkout");
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { data: cart, loaded } = useSelector((s) => s.cart);
  const draft = store.get(DRAFT_KEY, {});
  const [step, setStep] = useState(1);
  const [contact, setContact] = useState({ email: user?.email || draft.contact?.email || "", phone: draft.contact?.phone || "" });
  const [address, setAddress] = useState(draft.address || EMPTY_ADDR);
  const [billingSame, setBillingSame] = useState(true);
  const [billing, setBilling] = useState(EMPTY_ADDR);
  const [errors, setErrors] = useState({});
  const [shippingMethod, setShippingMethod] = useState(draft.shippingMethod || "standard");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [terms, setTerms] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [notes, setNotes] = useState("");
  const [quote, setQuote] = useState(null);
  const [changes, setChanges] = useState([]);
  const [busy, setBusy] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState(null);
  const started = useRef(false);

  const { data: saved = [] } = useAsync(() => (user ? accountApi.addresses() : Promise.resolve([])), [user?.id]);
  const [selectedSaved, setSelectedSaved] = useState(null);
  useEffect(() => {
    if (saved.length && !draft.address && selectedSaved === null) {
      const def = saved.find((a) => a.isDefault) || saved[0];
      setSelectedSaved(def._id);
      setAddress({ ...EMPTY_ADDR, ...def });
      setContact((c) => ({ ...c, phone: c.phone || def.phone }));
    }
  }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      checkoutApi.start().catch(() => {});
    }
  }, []);
  useEffect(() => store.set(DRAFT_KEY, { contact, address, shippingMethod }), [contact, address, shippingMethod]);
  useEffect(() => {
    // Bring the active step into view when moving between steps.
    const el = document.querySelector('[aria-current="step"]');
    if (el && step > 1) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const validate = async (overrides = {}) => {
    setBusy(true);
    try {
      const r = await checkoutApi.validate({ address: overrides.address || address, shippingMethod: overrides.shippingMethod || shippingMethod });
      setQuote(r.quote);
      return r;
    } catch (e) {
      toast.error(errorMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const contactAndAddressNext = async (e) => {
    e.preventDefault();
    const errs = validateAddress({ ...address, phone: address.phone || contact.phone }, contact);
    if (!PHONE_RE.test((contact.phone || address.phone || "").replace(/\s/g, ""))) errs.contactPhone = "Enter a valid phone";
    if (!billingSame) {
      const be = validateAddress(billing);
      Object.entries(be).forEach(([k, v]) => (errs[`billing.${k}`] = v));
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.querySelector("[aria-invalid=true]")?.focus();
      return;
    }
    const r = await validate();
    if (r) setStep(2);
  };

  const shippingNext = async () => {
    const r = await validate({ shippingMethod });
    if (r) {
      setStep(3);
      if (!store.get(IDEM_KEY)) store.set(IDEM_KEY, uuid());
    }
  };

  const expected = useMemo(() => quote && { total: quote.total, lines: quote.items.map((l) => ({ variantId: l.variantId, unitPrice: l.unitPrice, quantity: l.quantity })) }, [quote]);

  const placeOrder = async () => {
    if (!terms) {
      setErrors({ acceptTerms: "Please accept the terms to continue" });
      return;
    }
    setPlacing(true);
    setPlaceError(null);
    let key = store.get(IDEM_KEY);
    if (!key) {
      key = uuid();
      store.set(IDEM_KEY, key);
    }
    try {
      const res = await checkoutApi.placeOrder({
        contact: { email: contact.email, phone: contact.phone || address.phone }, shippingAddress: { ...address, phone: address.phone || contact.phone },
        billingSameAsShipping: billingSame, billingAddress: billingSame ? undefined : billing, shippingMethod, paymentMethod,
        acceptTerms: terms, expected, notes, saveAddress: !!user && saveAddress && !selectedSaved,
      }, key);
      store.del(IDEM_KEY);
      store.del(DRAFT_KEY);
      if (res.nextAction === "redirect" && res.payment?.redirectUrl) {
        window.location.assign(res.payment.redirectUrl);
        return;
      }
      dispatch(fetchCart());
      navigate(`/orders/${res.order.orderNumber}?t=${res.order.accessToken}&placed=1`, { replace: true });
    } catch (e) {
      const code = errorCode(e);
      store.del(IDEM_KEY); // nothing was created; next attempt gets a fresh key
      if (code === "CHECKOUT_CHANGED" || code === "CART_INVALID") {
        const d = errorDetails(e);
        if (d.quote) setQuote({ ...d.quote, items: d.quote.lines || d.quote.items });
        setChanges(d.changes || []);
        setPlaceError(errorMessage(e));
        dispatch(fetchCart());
      } else if (code === "INSUFFICIENT_STOCK") {
        setPlaceError(errorMessage(e));
        dispatch(fetchCart());
      } else if (code === "VALIDATION_ERROR") {
        setErrors(errorDetails(e));
        setPlaceError("Please check your details.");
        setStep(1);
      } else setPlaceError(errorMessage(e));
      setPlacing(false);
    }
  };

  if (!loaded && !cart) return <PageLoader />;
  if (!cart?.items?.length && !placing)
    return (
      <div className="container-x py-10">
        <EmptyState title="Your cart is empty" action={<Link to="/products" className="btn-primary">Browse products</Link>}>Add something to your cart to check out.</EmptyState>
      </div>
    );

  const lines = quote?.items || cart.items;
  const blockingLines = lines.filter((l) => l.blocking && !l.issues.every((i) => i.code === "PRICE_CHANGED"));

  return (
    <div className="container-x py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-muted"><HiOutlineLockClosed /> Secure checkout</span>
      </div>
      {!user && (
        <Alert tone="info" className="mb-6">
          Checking out as a guest. <Link to="/auth/login?next=/checkout" className="link">Sign in</Link> for saved addresses and order history — your cart comes with you.
        </Alert>
      )}
      {blockingLines.length > 0 && (
        <Alert tone="error" className="mb-6" title="Some items can’t be ordered" action={<Link to="/cart" className="btn-outline btn-sm">Review cart</Link>}>
          {blockingLines.map((l) => `${l.name}: ${l.issues.map((i) => i.message).join(" ")}`).join(" · ")}
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <Step n={1} title="Contact & delivery address" active={step === 1} done={step > 1} onEdit={() => setStep(1)}
            summary={<>{contact.email} · {contact.phone || address.phone}<br />{address.fullName}, {address.line1}{address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.province}</>}>
            <form onSubmit={contactAndAddressNext} noValidate className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" error={errors.email} required hint="Order confirmation goes here">
                  <Input type="email" autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} error={errors.email} disabled={!!user} />
                </Field>
                <Field label="Mobile number" error={errors.contactPhone} required>
                  <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" value={contact.phone} onChange={(e) => { setContact({ ...contact, phone: e.target.value }); if (!address.phone) setAddress({ ...address, phone: e.target.value }); }} error={errors.contactPhone} />
                </Field>
              </div>
              {saved.length > 0 && (
                <div>
                  <div className="label">Saved addresses</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {saved.map((a) => (
                      <button type="button" key={a._id} onClick={() => { setSelectedSaved(a._id); setAddress({ ...EMPTY_ADDR, ...a }); }}
                        className={`rounded-xl border p-3 text-left text-sm ${selectedSaved === a._id ? "border-ink ring-1 ring-ink" : "border-gray-200 hover:border-gray-400"}`}>
                        <div className="font-medium">{a.label || a.fullName}{a.isDefault && <span className="chip ml-2 bg-gray-100">Default</span>}</div>
                        <div className="text-xs text-ink-muted">{a.line1}, {a.city}</div>
                      </button>
                    ))}
                    <button type="button" onClick={() => { setSelectedSaved(""); setAddress({ ...EMPTY_ADDR, phone: contact.phone }); }}
                      className={`rounded-xl border border-dashed p-3 text-left text-sm font-medium ${selectedSaved === "" ? "border-ink" : "border-gray-300 text-ink-soft hover:border-gray-400"}`}>+ New address</button>
                  </div>
                </div>
              )}
              {(!saved.length || selectedSaved === "" || selectedSaved) && <AddressFields value={address} onChange={(a) => { setAddress(a); if (selectedSaved) setSelectedSaved(""); }} errors={errors} prefix="shipping " />}
              {user && selectedSaved === "" && <Checkbox label="Save this address to my account" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />}
              <Checkbox label="Billing address is the same as delivery" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} />
              {!billingSame && (
                <div>
                  <div className="mb-3 text-sm font-semibold">Billing address</div>
                  <AddressFields value={billing} onChange={setBilling} errors={Object.fromEntries(Object.entries(errors).filter(([k]) => k.startsWith("billing.")).map(([k, v]) => [k.slice(8), v]))} prefix="billing " />
                </div>
              )}
              <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto">Continue to delivery</Button>
            </form>
          </Step>

          <Step n={2} title="Delivery method" active={step === 2} done={step > 2} onEdit={() => setStep(2)}
            summary={quote && `${quote.shippingMethod.name} · ${quote.shippingMethod.eta} · ${money(quote.shippingFee, { free: true })}`}>
            <div className="space-y-3" role="radiogroup" aria-label="Delivery method">
              {(quote?.shippingMethods || []).map((m) => (
                <label key={m.code} className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 ${shippingMethod === m.code ? "border-ink ring-1 ring-ink" : "border-gray-200 hover:border-gray-400"}`}>
                  <input type="radio" name="ship" className="h-4 w-4 text-ink focus:ring-ink" checked={shippingMethod === m.code} onChange={() => { setShippingMethod(m.code); validate({ shippingMethod: m.code }); }} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{m.name}</div>
                    <div className="text-xs text-ink-muted">{m.eta} to {address.city}</div>
                  </div>
                  <div className="text-sm font-semibold">{m.price === 0 ? <span className="text-emerald-700">Free</span> : money(m.price)}</div>
                </label>
              ))}
              <Field label="Delivery notes (optional)">
                <Input value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Call before arriving, gate code…" />
              </Field>
              <Button size="lg" loading={busy} onClick={shippingNext}>Continue to review</Button>
            </div>
          </Step>

          <Step n={3} title="Review & pay" active={step === 3}>
            <div className="space-y-6">
              {changes.length > 0 && (
                <Alert tone="warning" title="Your order changed since you last looked">
                  <ul className="mt-1 list-disc pl-4">
                    {changes.map((c, i) => (
                      <li key={i}>{c.message}{c.previous !== undefined && c.current !== undefined ? `: ${money(c.previous)} → ${money(c.current)}` : ""}</li>
                    ))}
                  </ul>
                  <p className="mt-2">The prices below are up to date. Place your order again to confirm.</p>
                </Alert>
              )}
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {lines.map((l) => (
                  <div key={l.variantId} className="flex items-center gap-3 p-3">
                    <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100"><ProductImage src={l.image} alt={l.name} /></div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{l.name}</div>
                      <div className="text-xs text-ink-muted">{l.options !== "Default" && `${l.options} · `}Qty {l.quantity} × {money(l.unitPrice)}</div>
                      {l.issues?.map((i) => <div key={i.code} className={`text-xs font-medium ${i.code === "PRICE_CHANGED" ? "text-amber-700" : "text-red-600"}`}>{i.message}</div>)}
                    </div>
                    <div className="text-sm font-semibold tabular-nums">{money(l.lineTotal)}</div>
                  </div>
                ))}
              </div>

              <div>
                <div className="mb-3 text-sm font-semibold">Payment method</div>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
                  {PAYMENTS.map(({ v, l, d, icon: Icon }) => {
                    const disabled = v === "cod" && quote?.total > 5000000;
                    return (
                      <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${paymentMethod === v ? "border-ink ring-1 ring-ink" : "border-gray-200 hover:border-gray-400"} ${disabled ? "pointer-events-none opacity-40" : ""}`}>
                        <input type="radio" name="pay" className="mt-1 h-4 w-4 text-ink focus:ring-ink" checked={paymentMethod === v} disabled={disabled} onChange={() => setPaymentMethod(v)} />
                        <Icon className="mt-0.5 h-5 w-5 text-ink-muted" />
                        <div>
                          <div className="text-sm font-semibold">{l}</div>
                          <div className="text-xs text-ink-muted">{d}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {paymentMethod !== "cod" && <p className="mt-2 text-xs text-ink-muted">You’ll be taken to our payment partner’s secure page. Card details never touch our servers.</p>}
              </div>

              <Checkbox checked={terms} onChange={(e) => { setTerms(e.target.checked); setErrors({}); }}
                label={<>I agree to the <a href="/about" target="_blank" className="link">terms of sale</a> and <a href="/about" target="_blank" className="link">return policy</a>.</>} />
              {errors.acceptTerms && <p className="-mt-4 text-xs font-medium text-red-600">{errors.acceptTerms}</p>}
              {placeError && <Alert tone="error">{placeError}</Alert>}
              <Button size="lg" className="w-full" loading={placing} disabled={blockingLines.length > 0 || busy} onClick={placeOrder}>
                <HiOutlineLockClosed /> {paymentMethod === "cod" ? "Place order" : "Place order & pay"} {quote && money(quote.total)}
              </Button>
              <p className="text-center text-xs text-ink-muted">Stock is held for 15 minutes while you complete payment.</p>
            </div>
          </Step>
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <OrderSummary q={quote || cart}>
            <ul className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              {cart.items.map((l) => (
                <li key={l.id} className="flex items-center gap-3">
                  <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    <ProductImage src={l.image} alt="" />
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white">{l.quantity}</span>
                  </div>
                  <div className="min-w-0 flex-1 truncate text-xs">{l.name}<div className="text-ink-muted">{l.options !== "Default" && l.options}</div></div>
                  <div className="text-xs font-medium">{money(l.lineTotal)}</div>
                </li>
              ))}
            </ul>
          </OrderSummary>
        </div>
      </div>
    </div>
  );
}
