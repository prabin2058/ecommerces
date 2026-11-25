import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { HiOutlineShoppingBag, HiOutlineMapPin, HiOutlineShieldCheck } from "react-icons/hi2";
import { useAsync, useDocumentTitle } from "@store/shared";
import { accountApi, authApi } from "../../api";
import { errorMessage } from "@store/shared";
import { refreshMe, setUser } from "../../redux/auth/authSlice";
import { money, dateTime } from "@store/shared";
import { PageLoader, StatusBadge, EmptyState, Button, Modal, Field, Input, Select, Checkbox, Alert, ProductImage } from "@store/shared";

export function AccountLayout() {
  const { user } = useSelector((s) => s.auth);
  const tab = ({ isActive }) => `flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium ${isActive ? "bg-gray-100 text-ink" : "text-ink-soft hover:bg-gray-50"}`;
  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-bold tracking-tight">Hi, {user?.name?.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-ink-muted">{user?.email}</p>
      <div className="mt-6 flex flex-col gap-8 md:flex-row">
        <nav className="flex gap-1 overflow-x-auto md:w-52 md:flex-col">
          <NavLink end to="/account" className={tab}><HiOutlineShoppingBag className="h-5 w-5" /> Orders</NavLink>
          <NavLink to="/account/addresses" className={tab}><HiOutlineMapPin className="h-5 w-5" /> Addresses</NavLink>
          <NavLink to="/account/security" className={tab}><HiOutlineShieldCheck className="h-5 w-5" /> Security</NavLink>
        </nav>
        <div className="min-w-0 flex-1"><Outlet /></div>
      </div>
    </div>
  );
}

export function AccountOrders() {
  useDocumentTitle("My orders");
  const { data: orders, loading } = useAsync(() => accountApi.orders(), []);
  if (loading) return <PageLoader />;
  if (!orders?.length) return <EmptyState icon={HiOutlineShoppingBag} title="No orders yet" action={<Link to="/products" className="btn-primary">Start shopping</Link>}>When you place an order it will show up here.</EmptyState>;
  return (
    <div className="space-y-4">
      {orders.map((o) => (
        <Link key={o.id} to={`/orders/${o.orderNumber}?t=${o.accessToken}`} className="card block p-5 transition hover:shadow-pop">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">{o.orderNumber}</div>
              <div className="text-xs text-ink-muted">{dateTime(o.createdAt)} · {o.items.reduce((s, i) => s + i.quantity, 0)} items</div>
            </div>
            <div className="flex items-center gap-3"><StatusBadge status={o.status} /><span className="font-semibold">{money(o.total)}</span></div>
          </div>
          <div className="mt-4 flex gap-2">
            {o.items.slice(0, 5).map((i, k) => <div key={k} className="h-14 w-12 overflow-hidden rounded-lg bg-gray-100"><ProductImage src={i.image} alt={i.productName} /></div>)}
            {o.items.length > 5 && <div className="flex h-14 w-12 items-center justify-center rounded-lg bg-gray-100 text-xs font-medium">+{o.items.length - 5}</div>}
          </div>
        </Link>
      ))}
    </div>
  );
}

const PROVINCES = ["Koshi", "Madhesh", "Bagmati", "Gandaki", "Lumbini", "Karnali", "Sudurpashchim"];
const EMPTY = { label: "", fullName: "", phone: "", line1: "", line2: "", city: "", province: "Bagmati", isDefault: false };

export function AccountAddresses() {
  useDocumentTitle("Addresses");
  const { data: list = [], loading, setData } = useAsync(() => accountApi.addresses(), []);
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = editing._id ? await accountApi.updateAddress(editing._id, editing) : await accountApi.addAddress(editing);
      setData(r);
      setEditing(null);
      toast.success("Address saved");
    } catch (e) {
      setErrors(e.response?.data?.details || {});
      if (!e.response?.data?.details) toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  if (loading) return <PageLoader />;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Saved addresses</h2>
        <Button size="sm" onClick={() => { setErrors({}); setEditing({ ...EMPTY }); }}>Add address</Button>
      </div>
      {!list.length ? (
        <EmptyState icon={HiOutlineMapPin} title="No saved addresses">Addresses you save at checkout appear here.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((a) => (
            <div key={a._id} className="card p-5 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-semibold">{a.label || a.fullName}</div>
                {a.isDefault && <span className="chip bg-gray-100">Default</span>}
              </div>
              <address className="mt-2 not-italic text-ink-soft">{a.fullName}<br />{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.province}<br />{a.phone}</address>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setErrors({}); setEditing({ ...a }); }}>Edit</Button>
                {!a.isDefault && <Button size="sm" variant="ghost" onClick={async () => setData(await accountApi.updateAddress(a._id, { isDefault: true }))}>Make default</Button>}
                <Button size="sm" variant="ghost" className="text-red-600" onClick={async () => setData(await accountApi.removeAddress(a._id))}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?._id ? "Edit address" : "New address"}
        footer={<><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Label (optional)" className="sm:col-span-2"><Input placeholder="Home, Office…" value={editing.label || ""} onChange={set("label")} /></Field>
            <Field label="Full name" error={errors.fullName}><Input value={editing.fullName} onChange={set("fullName")} error={errors.fullName} /></Field>
            <Field label="Phone" error={errors.phone}><Input value={editing.phone} onChange={set("phone")} error={errors.phone} /></Field>
            <Field label="Street address" error={errors.line1} className="sm:col-span-2"><Input value={editing.line1} onChange={set("line1")} error={errors.line1} /></Field>
            <Field label="Landmark (optional)" className="sm:col-span-2"><Input value={editing.line2 || ""} onChange={set("line2")} /></Field>
            <Field label="City" error={errors.city}><Input value={editing.city} onChange={set("city")} error={errors.city} /></Field>
            <Field label="Province"><Select value={editing.province} onChange={set("province")}>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
            <Checkbox className="sm:col-span-2" label="Make this my default address" checked={!!editing.isDefault} onChange={set("isDefault")} />
          </div>
        )}
      </Modal>
    </div>
  );
}

export function AccountSecurity() {
  useDocumentTitle("Security");
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const start = async () => {
    setBusy(true);
    try {
      setSetup(await authApi.setup2fa());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const u = await authApi.confirm2fa(code);
      if (u.token) localStorage.setItem("authToken", u.token);
      dispatch(setUser(u));
      dispatch(refreshMe());
      setSetup(null);
      toast.success("Two-factor authentication is on");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card max-w-xl p-6">
      <h2 className="text-lg font-semibold">Two-factor authentication</h2>
      <p className="mt-1 text-sm text-ink-muted">Protect your account with a code from an authenticator app (Google Authenticator, 1Password, Authy). Required for staff accounts in production.</p>
      {user?.twoFactorEnabled ? (
        <Alert tone="success" className="mt-5" title="2FA is enabled">You’ll be asked for a code each time you sign in.</Alert>
      ) : setup ? (
        <div className="mt-5 space-y-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-soft">
            <li>In your authenticator app, add an account using this setup key:</li>
          </ol>
          <div className="select-all break-all rounded-xl bg-gray-50 p-4 text-center font-mono text-lg tracking-widest">{setup.secret.match(/.{1,4}/g).join(" ")}</div>
          <a href={setup.otpauthUrl} className="link block text-center text-xs">Open in authenticator app (on this device)</a>
          <ol start={2} className="list-decimal pl-5 text-sm text-ink-soft"><li>Enter the 6-digit code it shows:</li></ol>
          <Field error={error}>
            <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center font-mono text-xl tracking-[0.4em]" error={error} />
          </Field>
          <Button className="w-full" loading={busy} disabled={code.length !== 6} onClick={confirm}>Turn on 2FA</Button>
        </div>
      ) : (
        <Button className="mt-5" loading={busy} onClick={start}>Set up 2FA</Button>
      )}
    </div>
  );
}
