import { useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useAsync, useDocumentTitle } from "@store/shared";
import { adminApi } from "../api";
import { errorMessage, errorDetails } from "@store/shared";
import { money, toPaisa, toRupees, date } from "@store/shared";
import { isAdmin } from "../redux/authSlice";
import { PageHeader } from "../layouts/AdminLayout";
import { Button, Modal, Field, Input, Select, Checkbox, PageLoader, Badge } from "@store/shared";

const blank = { code: "", description: "", type: "percent", value: "", maxDiscount: "", minSpend: "", usageLimit: "", startsAt: "", expiresAt: "", isActive: true };
const toForm = (c) => ({
  ...blank, ...c, value: c.type === "percent" ? String(c.value) : toRupees(c.value), maxDiscount: toRupees(c.maxDiscount), minSpend: toRupees(c.minSpend) === "0" ? "" : toRupees(c.minSpend),
  usageLimit: c.usageLimit ?? "", startsAt: c.startsAt ? c.startsAt.slice(0, 10) : "", expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
});

function describe(c) {
  if (c.type === "percent") return `${c.value}% off${c.maxDiscount ? ` (max ${money(c.maxDiscount)})` : ""}`;
  if (c.type === "fixed") return `${money(c.value)} off`;
  return "Free shipping";
}

export default function Coupons() {
  useDocumentTitle("Coupons");
  const { user } = useSelector((s) => s.auth);
  const { data: list = [], loading, reload } = useAsync(() => adminApi.coupons(), []);
  const [edit, setEdit] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const admin = isAdmin(user);
  const save = async () => {
    setBusy(true);
    const body = {
      code: edit.code, description: edit.description, type: edit.type, isActive: edit.isActive,
      value: edit.type === "percent" ? Number(edit.value || 0) : edit.type === "fixed" ? toPaisa(edit.value || 0) : 0,
      maxDiscount: edit.maxDiscount === "" ? null : toPaisa(edit.maxDiscount), minSpend: edit.minSpend === "" ? 0 : toPaisa(edit.minSpend),
      usageLimit: edit.usageLimit === "" ? null : Number(edit.usageLimit), startsAt: edit.startsAt || null, expiresAt: edit.expiresAt ? `${edit.expiresAt}T23:59:59` : null,
    };
    try {
      if (edit._id) await adminApi.updateCoupon(edit._id, body);
      else await adminApi.createCoupon(body);
      toast.success("Coupon saved");
      setEdit(null);
      reload({ silent: true });
    } catch (e) {
      setErrors(errorDetails(e));
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  if (loading) return <PageLoader />;
  const status = (c) => {
    if (!c.isActive) return <Badge>Inactive</Badge>;
    if (c.expiresAt && new Date(c.expiresAt) < new Date()) return <Badge tone="yellow">Expired</Badge>;
    if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return <Badge tone="yellow">Used up</Badge>;
    if (c.startsAt && new Date(c.startsAt) > new Date()) return <Badge tone="blue">Scheduled</Badge>;
    return <Badge tone="green">Active</Badge>;
  };
  return (
    <>
      <PageHeader title="Coupons" description="Coupons are re-validated at checkout: dates, minimum spend and usage limit." actions={admin && <Button onClick={() => { setErrors({}); setEdit({ ...blank }); }}>Create coupon</Button>} />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-5 py-3">Code</th><th className="px-3 py-3">Discount</th><th className="px-3 py-3">Min. spend</th><th className="px-3 py-3">Used</th><th className="px-3 py-3">Expires</th><th className="px-3 py-3">Status</th><th /></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((c) => (
              <tr key={c._id} className="hover:bg-gray-50">
                <td className="px-5 py-3"><div className="font-mono font-semibold">{c.code}</div><div className="text-xs text-ink-muted">{c.description}</div></td>
                <td className="px-3 py-3">{describe(c)}</td>
                <td className="px-3 py-3">{c.minSpend ? money(c.minSpend) : "—"}</td>
                <td className="px-3 py-3 tabular-nums">{c.usedCount}{c.usageLimit !== null && ` / ${c.usageLimit}`}</td>
                <td className="px-3 py-3 text-xs">{c.expiresAt ? date(c.expiresAt) : "Never"}</td>
                <td className="px-3 py-3">{status(c)}</td>
                <td className="px-5 py-3 text-right">{admin && <Button size="sm" variant="ghost" onClick={() => { setErrors({}); setEdit(toForm(c)); }}>Edit</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?._id ? `Edit ${edit.code}` : "New coupon"}
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code" error={errors.code} required><Input value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} className="font-mono uppercase" error={errors.code} /></Field>
            <Field label="Type"><Select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}><option value="percent">Percentage</option><option value="fixed">Fixed amount</option><option value="free_shipping">Free shipping</option></Select></Field>
            {edit.type !== "free_shipping" && <Field label={edit.type === "percent" ? "Percent off" : "Amount off (Rs)"} error={errors.value}><Input type="number" min="0" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} error={errors.value} /></Field>}
            {edit.type === "percent" && <Field label="Max discount (Rs)" hint="Optional cap"><Input type="number" min="0" value={edit.maxDiscount} onChange={(e) => setEdit({ ...edit, maxDiscount: e.target.value })} /></Field>}
            <Field label="Minimum spend (Rs)"><Input type="number" min="0" value={edit.minSpend} onChange={(e) => setEdit({ ...edit, minSpend: e.target.value })} /></Field>
            <Field label="Usage limit" hint="Total redemptions; empty = unlimited"><Input type="number" min="0" value={edit.usageLimit} onChange={(e) => setEdit({ ...edit, usageLimit: e.target.value })} /></Field>
            <Field label="Starts"><Input type="date" value={edit.startsAt} onChange={(e) => setEdit({ ...edit, startsAt: e.target.value })} /></Field>
            <Field label="Expires"><Input type="date" value={edit.expiresAt} onChange={(e) => setEdit({ ...edit, expiresAt: e.target.value })} /></Field>
            <Field label="Description" className="sm:col-span-2" hint="Shown to customers"><Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Checkbox className="sm:col-span-2" label="Active" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />
          </div>
        )}
      </Modal>
    </>
  );
}
