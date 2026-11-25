import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { HiOutlineXCircle, HiOutlineClock } from "react-icons/hi2";
import { ordersApi } from "../../api";
import { errorMessage } from "@store/shared";
import { fetchCart } from "../../redux/cart/cartSlice";
import { Spinner, Button, Alert } from "@store/shared";
import { money } from "@store/shared";
import { useDocumentTitle } from "@store/shared";

function useCountdown(until) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!until) return null;
  const s = Math.max(0, Math.floor((new Date(until) - now) / 1000));
  return { s, label: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` };
}

export function RetryPayment({ order, token, failure }) {
  const [method, setMethod] = useState(order.paymentMethod === "cod" ? "card" : order.paymentMethod);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const left = useCountdown(order.reservationExpiresAt);
  const retry = async () => {
    setBusy(true);
    try {
      const r = await ordersApi.pay(order.orderNumber, token, method);
      window.location.assign(r.redirectUrl);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      {failure && <Alert tone="error" title="Payment didn’t go through">{failure} Your items are still reserved and your cart is saved.</Alert>}
      {left && (
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <HiOutlineClock className="h-5 w-5" />
          {left.s > 0 ? <>Items held for <b className="tabular-nums">{left.label}</b> — complete payment to keep them.</> : "Reservation expired."}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {[["card", "Card"], ["wallet", "Wallet"], ["bank", "Bank"]].map(([v, l]) => (
          <button key={v} onClick={() => setMethod(v)} className={`rounded-xl border py-2.5 text-sm font-medium ${method === v ? "border-ink bg-ink text-white" : "border-gray-300 hover:border-ink"}`}>{l}</button>
        ))}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Button size="lg" className="w-full" loading={busy} disabled={left?.s === 0} onClick={retry}>Try again · {money(order.total)}</Button>
    </div>
  );
}

export default function CheckoutReturn() {
  useDocumentTitle("Confirming payment");
  const [params] = useSearchParams();
  const number = params.get("order");
  const token = params.get("t");
  const cancelled = params.get("cancelled") === "1";
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [order, setOrder] = useState(null);
  const [state, setState] = useState("checking"); // checking | failed | slow | error
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    let tries = 0;
    const poll = async () => {
      try {
        // sync=1 asks the server to check with the gateway; the browser redirect itself proves nothing.
        const o = await ordersApi.get(number, token, true);
        if (!alive) return;
        setOrder(o);
        if (o.status !== "pending_payment") {
          dispatch(fetchCart());
          navigate(`/orders/${number}?t=${token}&placed=1`, { replace: true });
          return;
        }
        if (cancelled || ["failed", "cancelled"].includes(o.lastPayment?.status)) {
          setState("failed");
          return;
        }
        if (++tries > 15) {
          setState("slow");
          return;
        }
        setTimeout(poll, 1500);
      } catch (e) {
        if (alive) {
          setError(errorMessage(e));
          setState("error");
        }
      }
    };
    poll();
    return () => {
      alive = false;
    };
  }, [number, token, cancelled, navigate, dispatch]);

  return (
    <div className="container-x flex min-h-[60vh] items-center justify-center py-10">
      <div className="card w-full max-w-md p-8">
        {state === "checking" && (
          <div className="text-center">
            <Spinner className="mx-auto h-10 w-10 text-brand-600" />
            <h1 className="mt-5 text-xl font-semibold">Confirming your payment…</h1>
            <p className="mt-2 text-sm text-ink-muted">This usually takes a few seconds. Please don’t close this page.</p>
          </div>
        )}
        {state === "failed" && order && (
          <>
            <div className="mb-5 text-center">
              <HiOutlineXCircle className="mx-auto h-12 w-12 text-red-500" />
              <h1 className="mt-3 text-xl font-semibold">{cancelled ? "Payment cancelled" : "Payment failed"}</h1>
              <p className="mt-1 text-sm text-ink-muted">Order {order.orderNumber}</p>
            </div>
            <RetryPayment order={order} token={token} failure={cancelled ? "You cancelled the payment." : order.lastPayment?.failureReason} />
            <Link to="/cart" className="mt-4 block text-center text-sm text-ink-muted hover:text-ink">Back to cart</Link>
          </>
        )}
        {state === "slow" && (
          <div className="text-center">
            <HiOutlineClock className="mx-auto h-12 w-12 text-amber-500" />
            <h1 className="mt-3 text-xl font-semibold">Still waiting for the bank</h1>
            <p className="mt-2 text-sm text-ink-muted">We haven’t received confirmation yet. If you were charged, your order will update automatically — we’ll email you either way.</p>
            <Link to={`/orders/${number}?t=${token}`} className="btn-primary mt-6">View order status</Link>
          </div>
        )}
        {state === "error" && <Alert tone="error" title="Couldn’t load your order">{error}</Alert>}
      </div>
    </div>
  );
}
