import { useSelector } from "react-redux";
import { Navigate, Outlet, useLocation } from "react-router-dom";

export function RequireAuth() {
  const { user } = useSelector((s) => s.auth);
  const loc = useLocation();
  return user ? <Outlet /> : <Navigate to={`/auth/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
}

export function GuestOnly() {
  const { user } = useSelector((s) => s.auth);
  const next = new URLSearchParams(useLocation().search).get("next");
  return user ? <Navigate to={next && next.startsWith("/") ? next : "/"} replace /> : <Outlet />;
}
