import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { HiOutlineShoppingBag, HiOutlineUser, HiMagnifyingGlass, HiBars3, HiXMark, HiOutlineSquares2X2, HiArrowRightOnRectangle } from "react-icons/hi2";
import { openDrawer } from "../../redux/cart/cartSlice";
import { logout, isStaff } from "../../redux/auth/authSlice";
import { catalogApi } from "../../api";
import { useAsync, useDebounced } from "@store/shared";
import { money, sized } from "@store/shared";

// The admin dashboard is a separate app (../dashboard).
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || "http://localhost:5180";

function SearchBox({ onDone, autoFocus }) {
  const [q, setQ] = useState(new URLSearchParams(useLocation().search).get("q") || "");
  const [open, setOpen] = useState(false);
  const dq = useDebounced(q.trim(), 200);
  const navigate = useNavigate();
  const { data: suggestions = [] } = useAsync(() => (dq.length >= 2 ? catalogApi.suggest(dq) : Promise.resolve([])), [dq]);
  const box = useRef(null);
  useEffect(() => {
    const h = (e) => !box.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const submit = (e) => {
    e.preventDefault();
    setOpen(false);
    navigate(`/products${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
    onDone?.();
  };
  return (
    <form ref={box} onSubmit={submit} className="relative w-full" role="search">
      <HiMagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
      <input
        value={q} autoFocus={autoFocus} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Search products, brands…" aria-label="Search products"
        className="h-10 w-full rounded-full border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-100"
      />
      {open && dq.length >= 2 && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-12 z-50 animate-pop-in overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-pop">
          {suggestions.map((s) => (
            <Link key={s.id} to={`/products/${s.slug}`} onClick={() => { setOpen(false); onDone?.(); }} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50">
              <img src={sized(s.image, 120)} alt="" className="h-10 w-10 rounded-lg object-cover" />
              <span className="flex-1 truncate text-sm font-medium">{s.name}</span>
              <span className="text-sm text-ink-muted">{money(s.priceMin)}</span>
            </Link>
          ))}
          <button type="submit" className="w-full border-t border-gray-100 px-3 py-2.5 text-left text-sm font-medium text-brand-600 hover:bg-gray-50">See all results for “{q}”</button>
        </div>
      )}
    </form>
  );
}

function AccountMenu({ user }) {
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  if (!user)
    return (
      <Link to="/auth/login" className="hidden items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-ink-soft hover:bg-gray-100 sm:flex">
        <HiOutlineUser className="h-5 w-5" /> Sign in
      </Link>
    );
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 hover:bg-brand-100" aria-label="Account menu" aria-expanded={open}>
        {user.name?.[0]?.toUpperCase() || "U"}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-60 animate-pop-in rounded-2xl border border-gray-200 bg-white p-2 shadow-pop" onClick={() => setOpen(false)}>
          <div className="px-3 py-2">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <div className="truncate text-xs text-ink-muted">{user.email}</div>
          </div>
          <div className="my-1 h-px bg-gray-100" />
          <Link to="/account" className="block rounded-lg px-3 py-2 text-sm hover:bg-gray-50">My orders</Link>
          <Link to="/account/addresses" className="block rounded-lg px-3 py-2 text-sm hover:bg-gray-50">Addresses</Link>
          <Link to="/account/security" className="block rounded-lg px-3 py-2 text-sm hover:bg-gray-50">Security</Link>
          {isStaff(user) && (
            <a href={DASHBOARD_URL} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50">
              <HiOutlineSquares2X2 /> Admin dashboard
            </a>
          )}
          <div className="my-1 h-px bg-gray-100" />
          <button onClick={() => dispatch(logout())} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink-soft hover:bg-gray-50">
            <HiArrowRightOnRectangle /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const NAV = [
  { to: "/products", label: "Shop all" },
  { to: "/products?category=clothing", label: "Clothing" },
  { to: "/products?category=electronics", label: "Electronics" },
  { to: "/products?category=home-living", label: "Home" },
  { to: "/products?category=accessories", label: "Accessories" },
];

export default function Header() {
  const { user } = useSelector((s) => s.auth);
  const count = useSelector((s) => s.cart.data?.itemCount || 0);
  const dispatch = useDispatch();
  const [mobile, setMobile] = useState(false);
  const loc = useLocation();
  useEffect(() => setMobile(false), [loc.pathname, loc.search]);
  const current = `${loc.pathname}${loc.search}`;

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/90 backdrop-blur-md">
      <div className="bg-ink px-4 py-2 text-center text-xs font-medium text-white">
        Free standard delivery on orders over Rs 5,000 · Cash on delivery available across Nepal
      </div>
      <div className="container-x flex h-16 items-center gap-4">
        <button className="-ml-2 rounded-lg p-2 lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu">
          <HiBars3 className="h-6 w-6" />
        </button>
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Prabin Store home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white">
            <HiOutlineShoppingBag className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">Prabin<span className="text-brand-600">.</span></span>
        </Link>
        <nav className="ml-4 hidden items-center gap-0.5 xl:ml-6 lg:flex">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition ${current === n.to ? "bg-gray-100 text-ink" : "text-ink-soft hover:text-ink"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden w-full max-w-[16rem] md:block xl:max-w-xs">
          <SearchBox />
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-2">
          <AccountMenu user={user} />
          <button onClick={() => dispatch(openDrawer())} className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100" aria-label={`Cart, ${count} items`}>
            <HiOutlineShoppingBag className="h-6 w-6" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">{count}</span>
            )}
          </button>
        </div>
      </div>
      <div className="container-x pb-3 md:hidden">
        <SearchBox />
      </div>

      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-gray-900/40" onClick={() => setMobile(false)} />
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] animate-fade-in bg-white p-5 shadow-pop">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-lg font-bold">Menu</span>
              <button onClick={() => setMobile(false)} className="rounded-lg p-1.5 hover:bg-gray-100" aria-label="Close menu"><HiXMark className="h-6 w-6" /></button>
            </div>
            <nav className="space-y-1">
              {NAV.map((n) => (
                <Link key={n.to} to={n.to} className="block rounded-xl px-3 py-3 font-medium hover:bg-gray-50">{n.label}</Link>
              ))}
              <div className="my-3 h-px bg-gray-100" />
              {user ? (
                <>
                  <NavLink to="/account" className="block rounded-xl px-3 py-3 font-medium hover:bg-gray-50">My account</NavLink>
                  {isStaff(user) && <a href={DASHBOARD_URL} className="block rounded-xl px-3 py-3 font-medium text-brand-700 hover:bg-gray-50">Admin dashboard</a>}
                </>
              ) : (
                <>
                  <NavLink to="/auth/login" className="block rounded-xl px-3 py-3 font-medium hover:bg-gray-50">Sign in</NavLink>
                  <NavLink to="/auth/register" className="block rounded-xl px-3 py-3 font-medium hover:bg-gray-50">Create account</NavLink>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
