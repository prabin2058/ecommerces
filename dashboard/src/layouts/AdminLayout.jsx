import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { HiOutlineSquares2X2, HiOutlineCube, HiOutlineShoppingCart, HiOutlineArchiveBox, HiOutlineTicket, HiOutlineTag, HiOutlineArrowUpTray, HiOutlineChartBar, HiOutlineUsers, HiBars3BottomLeft, HiXMark, HiOutlineArrowTopRightOnSquare, HiOutlineShieldExclamation, HiOutlineShieldCheck, HiOutlineMagnifyingGlass, HiOutlineBell, HiOutlineCog6Tooth, HiOutlineArrowRightOnRectangle } from "react-icons/hi2";
import { isAdmin, logout } from "../redux/authSlice";
import { STORE_URL } from "../config";
import { useAsync } from "@store/shared";
import { adminApi } from "../api";
import { errorCode } from "@store/shared";

const NAV = [
  { section: "Overview", items: [
    { to: "/", label: "Dashboard", icon: HiOutlineSquares2X2, end: true },
    { to: "/activity", label: "Activity", icon: HiOutlineChartBar },
  ] },
  { section: "Commerce", items: [
    { to: "/orders", label: "Orders", icon: HiOutlineShoppingCart },
    { to: "/inventory", label: "Inventory", icon: HiOutlineArchiveBox },
    { to: "/coupons", label: "Coupons", icon: HiOutlineTicket },
  ] },
  { section: "Catalog", items: [
    { to: "/products", label: "Products", icon: HiOutlineCube },
    { to: "/categories", label: "Categories", icon: HiOutlineTag },
    { to: "/import", label: "Import / export", icon: HiOutlineArrowUpTray },
  ] },
  { section: "Users & Access", items: [
    { to: "/users", label: "Staff & roles", icon: HiOutlineUsers, admin: true },
    { to: "/security", label: "Security", icon: HiOutlineShieldCheck },
  ] },
];
const ALL_ITEMS = NAV.flatMap((s) => s.items);

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-indigo-500">
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true"><path fill="currentColor" d="M4 4h9l-3 3H7v3L4 13zm16 16h-9l3-3h3v-3l3-3zM9 9h6v6H9z" /></svg>
      Prabin
    </Link>
  );
}

function UserMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Account menu" aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600 ring-2 ring-white hover:ring-indigo-200">
        {user?.name?.[0]?.toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-40 w-60 animate-pop-in rounded-xl border border-gray-100 bg-white p-1.5 shadow-pop">
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold text-ink">{user?.name}</div>
            <div className="truncate text-xs capitalize text-ink-muted">{user?.roles?.filter((r) => r !== "USER").join(", ").replace("_", " ").toLowerCase()}</div>
          </div>
          <div className="my-1 border-t border-gray-100" />
          <a href={STORE_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-gray-50"><HiOutlineArrowTopRightOnSquare className="h-4 w-4" /> View store</a>
          <button onClick={onSignOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"><HiOutlineArrowRightOnRectangle className="h-4 w-4" /> Sign out</button>
        </div>
      )}
    </div>
  );
}

export default function AdminLayout() {
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop sidebar
  const [q, setQ] = useState("");
  const loc = useLocation();
  const { data: me, error } = useAsync(() => adminApi.me(), []);
  const mfaBlocked = errorCode(error) === "MFA_REQUIRED";

  const sidebar = (
    <div className="flex h-full flex-col border-r border-gray-100 bg-white">
      <div className="flex h-[72px] shrink-0 items-center border-b border-gray-100 px-6"><Logo /></div>
      <nav className="flex-1 overflow-y-auto py-4">
        {NAV.map(({ section, items }) => {
          const visible = items.filter((n) => !n.admin || isAdmin(user));
          if (!visible.length) return null;
          return (
            <div key={section} className="mb-4">
              <div className="mb-1 px-6 text-[11px] font-medium uppercase tracking-wider text-gray-400">{section}</div>
              <div className="space-y-1 px-3">
                {visible.map(({ to, label, icon: Icon, end }) => (
                  <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
                    className={({ isActive }) => `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive
                      ? "bg-indigo-500 font-medium text-white shadow-sm before:absolute before:-left-3 before:top-0 before:h-full before:w-1 before:rounded-r before:bg-indigo-500"
                      : "text-gray-700 hover:bg-indigo-50 hover:text-indigo-600"}`}>
                    <Icon className="h-5 w-5" /> {label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );

  const search = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/products?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="min-h-svh bg-[#f7f8fa]">
      <aside className={`fixed inset-y-0 left-0 z-30 hidden w-64 transition-transform duration-200 lg:block ${collapsed ? "-translate-x-full" : ""}`}>{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 animate-fade-in">{sidebar}</div>
          <button onClick={() => setOpen(false)} className="absolute left-64 top-4 ml-2 rounded-lg bg-white p-1.5" aria-label="Close menu"><HiXMark className="h-5 w-5" /></button>
        </div>
      )}
      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-0" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-4 border-b border-gray-100 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button onClick={() => (window.matchMedia("(min-width: 1024px)").matches ? setCollapsed((c) => !c) : setOpen(true))}
            className="rounded-lg p-1.5 text-gray-700 hover:bg-gray-100" aria-label="Toggle menu"><HiBars3BottomLeft className="h-6 w-6" /></button>
          <form onSubmit={search} className="relative hidden w-full max-w-sm sm:block" role="search">
            <HiOutlineMagnifyingGlass className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products..." aria-label="Search products"
              className="h-11 w-full rounded-full border-0 bg-gray-100 pl-11 pr-4 text-sm outline-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-200" />
          </form>
          <span className="font-semibold sm:hidden">{ALL_ITEMS.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)))?.label || "Admin"}</span>
          <div className="ml-auto flex items-center gap-3">
            <Link to="/activity?tab=notifications" className="rounded-full p-2 text-indigo-500 hover:bg-indigo-50" aria-label="Notifications"><HiOutlineBell className="h-5 w-5" /></Link>
            <UserMenu user={user} onSignOut={() => dispatch(logout())} />
            <Link to="/security" className="rounded-full p-2 text-indigo-500 hover:bg-indigo-50" aria-label="Settings"><HiOutlineCog6Tooth className="h-5 w-5" /></Link>
          </div>
        </header>
        {!user?.twoFactorEnabled && (
          <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-900">
            <HiOutlineShieldExclamation className="h-4 w-4" /> Two-factor authentication is off for your account.
            <Link to="/security" className="font-semibold underline">Turn it on</Link> — it is required for staff in production.
          </div>
        )}
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {mfaBlocked && loc.pathname !== "/security" ? (
            <div className="card mx-auto mt-10 max-w-md p-8 text-center">
              <HiOutlineShieldExclamation className="mx-auto h-10 w-10 text-amber-500" />
              <h1 className="mt-3 text-lg font-semibold">Two-factor authentication required</h1>
              <p className="mt-1 text-sm text-ink-muted">Set up 2FA under Security, then sign out and back in with your code.</p>
              <Link to="/security" className="btn-primary mt-5">Set up 2FA</Link>
            </div>
          ) : me || error ? <Outlet /> : null}
        </main>
      </div>
    </div>
  );
}

 
export function PageHeader({ title, description, actions, back }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && <Link to={back.to} className="mb-1 inline-block text-sm text-ink-muted hover:text-ink">← {back.label}</Link>}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
