import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { HiOutlineCube, HiOutlineCurrencyDollar, HiUser, HiShoppingBag, HiArrowTrendingUp, HiArrowTrendingDown, HiOutlineExclamationTriangle, HiPlus } from "react-icons/hi2";
import { useAsync, useDocumentTitle, PageLoader, Alert, money, pct, errorMessage } from "@store/shared";
import { adminApi } from "../api";

// Indian-style compact rupees, as in the design: 5k, 70L, 1.40 Cr. Input is paisa.
function compactRs(paisa, { prefix = "Rs. " } = {}) {
  const r = (paisa || 0) / 100;
  if (r >= 1e7) return `${prefix}${(r / 1e7).toFixed(2)} Cr`;
  if (r >= 1e5) return `${prefix}${+(r / 1e5).toFixed(1)}L`;
  if (r >= 1e3) return `${prefix}${+(r / 1e3).toFixed(1)}k`;
  return `${prefix}${Math.round(r)}`;
}
const compactNum = (n) => (n >= 1e5 ? `${+(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${n}`);
const signedPct = (n) => `${n >= 0 ? "+" : "-"} ${(Math.abs(n) * 100).toFixed(Math.abs(n) < 0.1 ? 2 : 1)}%`;

const TONES = {
  indigo: "bg-indigo-50 text-indigo-500",
  green: "bg-emerald-50 text-emerald-500",
  amber: "bg-amber-50 text-amber-400",
  purple: "bg-purple-50 text-purple-500",
};

function IconTile({ icon: Icon, tone, size = "h-11 w-11" }) {
  return <div className={`flex ${size} shrink-0 items-center justify-center rounded-full ${TONES[tone]}`}><Icon className="h-5 w-5" /></div>;
}

function StatCard({ icon, tone, value, label, change }) {
  const up = change >= 0;
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-card">
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2">
          <span className="text-xl font-bold tabular-nums text-ink">{value}</span>
          {change !== null && (
            <span className={`flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-500" : "text-red-500"}`} title="vs. previous 30 days">
              {signedPct(change)} {up ? <HiArrowTrendingUp className="h-3.5 w-3.5" /> : <HiArrowTrendingDown className="h-3.5 w-3.5" />}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-ink-muted">{label}</div>
      </div>
    </div>
  );
}

// Smooth path through points (Catmull-Rom → cubic Bézier).
// Control points are clamped between the two segment ends so the curve never overshoots (e.g. below zero).
function smoothPath(pts) {
  if (pts.length < 2) return "";
  const clamp = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1y = clamp(p1[1] + (p2[1] - p0[1]) / 6, p1[1], p2[1]), c2y = clamp(p2[1] - (p3[1] - p1[1]) / 6, p1[1], p2[1]);
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${c1y} ${p2[0] - (p3[0] - p1[0]) / 6},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}
const niceMax = (v) => {
  if (v <= 0) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag / 0.4) * 0.4 * mag;
};

function TrendChart({ series }) {
  const [range, setRange] = useState("daily");
  const [hover, setHover] = useState(null);
  const data = series[range];
  const W = 640, H = 260, L = 48, R = 44, T = 12, B = 28;
  const { revMax, ordMax, rev, ord } = useMemo(() => {
    const revMax = niceMax(Math.max(...data.map((d) => d.revenue)));
    const ordMax = niceMax(Math.max(...data.map((d) => d.orders)));
    const x = (i) => L + (i * (W - L - R)) / Math.max(1, data.length - 1);
    const y = (v, m) => T + (H - T - B) * (1 - v / m);
    return { revMax, ordMax, rev: data.map((d, i) => [x(i), y(d.revenue, revMax)]), ord: data.map((d, i) => [x(i), y(d.orders, ordMax)]) };
  }, [data]);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const base = H - B;
  const area = (pts) => `${smoothPath(pts)} L${pts.at(-1)[0]},${base} L${pts[0][0]},${base} Z`;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink">Revenue &amp; Orders Trend Chart</h2>
          <p className="text-xs text-ink-muted">Track your sales performance over time</p>
        </div>
        <div className="flex rounded-full border border-gray-200 p-0.5 text-xs" role="tablist">
          {["daily", "weekly", "monthly"].map((k) => (
            <button key={k} role="tab" aria-selected={range === k} onClick={() => setRange(k)}
              className={`rounded-full px-4 py-1.5 font-medium capitalize transition ${range === k ? "bg-indigo-500 text-white" : "text-ink-muted hover:text-ink"}`}>{k}</button>
          ))}
        </div>
      </div>
      <div className="relative mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Revenue and orders trend" onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity=".18" /><stop offset="100%" stopColor="#6366f1" stopOpacity="0" /></linearGradient>
            <linearGradient id="gOrd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fbbf24" stopOpacity=".22" /><stop offset="100%" stopColor="#fbbf24" stopOpacity="0" /></linearGradient>
          </defs>
          {ticks.map((t) => {
            const y = T + (H - T - B) * (1 - t);
            return (
              <g key={t}>
                <line x1={L} x2={W - R} y1={y} y2={y} stroke="#eef0f4" strokeDasharray="3 3" />
                <text x={L - 8} y={y + 4} textAnchor="end" className="fill-gray-400 text-[10px]">{compactRs(revMax * t, { prefix: "" })}</text>
                <text x={W - R + 8} y={y + 4} className="fill-gray-400 text-[10px]">{compactNum(Math.round(ordMax * t))}</text>
              </g>
            );
          })}
          <text transform={`translate(12 ${(H - B) / 2}) rotate(-90)`} textAnchor="middle" className="fill-gray-400 text-[10px]">Revenue (Rs.)</text>
          <text transform={`translate(${W - 6} ${(H - B) / 2}) rotate(90)`} textAnchor="middle" className="fill-gray-400 text-[10px]">Orders</text>
          <path d={area(rev)} fill="url(#gRev)" />
          <path d={area(ord)} fill="url(#gOrd)" />
          <path d={smoothPath(rev)} fill="none" stroke="#6366f1" strokeWidth="2.5" />
          <path d={smoothPath(ord)} fill="none" stroke="#fbbf24" strokeWidth="2.5" />
          {data.map((d, i) => {
            const step = Math.ceil(data.length / 12);
            return (
              <g key={d.label + i}>
                {i % step === 0 && <text x={rev[i][0]} y={H - 8} textAnchor="middle" className="fill-gray-500 text-[10px]">{d.label}</text>}
                <rect x={rev[i][0] - (W - L - R) / data.length / 2} y={T} width={(W - L - R) / data.length} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={rev[hover][0]} x2={rev[hover][0]} y1={T} y2={base} stroke="#c7d2fe" />
              <circle cx={rev[hover][0]} cy={rev[hover][1]} r="4" fill="#6366f1" stroke="#fff" strokeWidth="2" />
              <circle cx={ord[hover][0]} cy={ord[hover][1]} r="4" fill="#fbbf24" stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>
        {hover !== null && (
          <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-pop"
            style={{ left: `${(rev[hover][0] / W) * 100}%` }}>
            <div className="font-medium">{data[hover].label}</div>
            <div>{money(data[hover].revenue)} · {data[hover].orders} orders</div>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-center gap-5 text-xs">
        <span className="flex items-center gap-1.5 text-indigo-500"><span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />Revenue</span>
        <span className="flex items-center gap-1.5 text-amber-400"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />Orders</span>
      </div>
    </div>
  );
}

function InventorySummary({ value, lowStock }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-500"><HiOutlineCube className="h-5 w-5" /></div>
      <div className="mt-4 text-xs text-ink-muted">Inventory Summary</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-ink">{money(value)}</div>
      <Link to="/inventory" className={`mt-2 flex items-center gap-1.5 text-xs ${lowStock ? "text-red-500" : "text-ink-muted"}`}>
        <HiOutlineExclamationTriangle className="h-3.5 w-3.5" /> {lowStock} Low stock items
      </Link>
    </div>
  );
}

function FulfillmentStatus({ active, pending }) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-500"><HiOutlineCube className="h-5 w-5" /></div>
      <div className="mt-4 text-xs text-ink-muted">Fulfillment Status</div>
      <div className="mt-3 grid grid-cols-2 divide-x divide-gray-200">
        <Link to="/orders?status=processing" className="pr-4">
          <div className="flex items-baseline gap-1.5"><span className="text-2xl font-bold text-emerald-500">{pad(active)}</span><span className="text-xs text-emerald-500">Active</span></div>
          <div className="mt-1 text-[11px] text-ink-muted">Orders in progress</div>
        </Link>
        <Link to="/orders?status=pending_payment" className="pl-4">
          <div className="flex items-baseline gap-1.5"><span className="text-2xl font-bold text-orange-400">{pad(pending)}</span><span className="text-xs text-orange-400">Pending</span></div>
          <div className="mt-1 text-[11px] text-ink-muted">Awaiting fulfillment</div>
        </Link>
      </div>
    </div>
  );
}

function ActivityLog({ orders, alerts }) {
  const items = [
    ...orders.map((o) => ({ id: o._id, title: `New Order ${o.orderNumber} placed`, at: o.createdAt, to: `/orders/${o._id}` })),
    ...alerts.filter((a) => !/^new order/i.test(a.subject)).map((a) => ({ id: a._id, title: a.subject, at: a.createdAt, to: "/activity?tab=notifications" })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  const dayLabel = (d) => {
    const x = new Date(d), t = new Date();
    if (x.toDateString() === t.toDateString()) return "Today";
    t.setDate(t.getDate() - 1);
    return x.toDateString() === t.toDateString() ? "Yesterday" : x.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  let lastDay = null;
  return (
    <div className="flex min-h-0 flex-col rounded-2xl bg-white p-5 shadow-card">
      <h2 className="text-base font-semibold text-ink">Activity Log</h2>
      <div className="mt-3 max-h-72 flex-1 overflow-y-auto pr-1">
        {!items.length && <p className="py-6 text-center text-sm text-ink-muted">No activity yet.</p>}
        <ol className="relative">
          {items.map((it) => {
            const day = dayLabel(it.at), showDay = day !== lastDay;
            lastDay = day;
            return (
              <li key={it.id}>
                {showDay && <div className="mb-2 mt-1 text-[11px] text-ink-muted">{day}</div>}
                <Link to={it.to} className="relative flex gap-3 pb-3 pl-1 before:absolute before:left-[7px] before:top-3 before:h-full before:border-l before:border-dashed before:border-indigo-200 last:before:hidden">
                  <span className="relative z-10 mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500 ring-4 ring-indigo-50" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-ink">{it.title}</span>
                    <span className="block text-[11px] text-ink-muted">{new Date(it.at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: "Create Product", to: "/products/new" },
  { label: "Add Inventory", to: "/inventory" },
  { label: "View Orders", to: "/orders" },
  { label: "Manage Users", to: "/users" },
  { label: "View Analytics", to: "/activity" },
  { label: "Create Coupon", to: "/coupons" },
  { label: "Add Category", to: "/categories" },
];

function QuickActions() {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="border-b border-gray-100 pb-3 text-base font-semibold text-ink">Quick Actions</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {QUICK_ACTIONS.map((a) => (
          <Link key={a.label} to={a.to} className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm text-ink-soft transition hover:bg-indigo-50 hover:text-indigo-600">
            <HiOutlineCube className="h-4 w-4" /> <span className="flex-1">{a.label}</span> <HiPlus className="h-4 w-4" />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  useDocumentTitle("Admin dashboard");
  const { user } = useSelector((s) => s.auth);
  const { data: d, loading, error } = useAsync(() => adminApi.dashboard(), []);
  if (loading) return <PageLoader />;
  if (error) return <Alert tone="error" title="Couldn’t load dashboard">{errorMessage(error)}</Alert>;
  const sc = d.statusCounts;
  const active = (sc.paid || 0) + (sc.confirmed || 0) + (sc.processing || 0) + (sc.shipped || 0);
  return (
    <>
      <h1 className="mb-5 text-xl font-bold text-ink">Welcome back, {user?.name?.split(" ")[0] || "Admin"}!</h1>
      {(d.stuckPending > 0 || d.paymentFailureRate > 0.3) && (
        <div className="mb-5 space-y-2">
          {d.stuckPending > 0 && <Alert tone="warning" title={`${d.stuckPending} order(s) stuck awaiting payment for 30+ minutes`} action={<Link className="btn-outline btn-sm" to="/orders?status=pending_payment">Review</Link>} />}
          {d.paymentFailureRate > 0.3 && <Alert tone="error" title={`Payment failure rate is ${pct(d.paymentFailureRate)} over 24h`}>Check the gateway status.</Alert>}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={HiOutlineCube} tone="indigo" value={compactNum(d.totals.orders)} label="Total Orders" change={d.totals.ordersChange} />
        <StatCard icon={HiOutlineCurrencyDollar} tone="green" value={compactRs(d.totals.revenue)} label="Total Revenue" change={d.totals.revenueChange} />
        <StatCard icon={HiUser} tone="amber" value={compactNum(d.totals.customers)} label="Total Customers" change={d.totals.customersChange} />
        <StatCard icon={HiShoppingBag} tone="purple" value={compactNum(d.totals.products)} label="Total Products" change={d.totals.productsChange} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <TrendChart series={d.series} />
          <QuickActions />
        </div>
        <div className="flex flex-col gap-4">
          <InventorySummary value={d.totals.inventoryValue} lowStock={d.lowStock} />
          <FulfillmentStatus active={active} pending={sc.pending_payment || 0} />
          <ActivityLog orders={d.recentOrders} alerts={d.alerts} />
        </div>
      </div>
    </>
  );
}
