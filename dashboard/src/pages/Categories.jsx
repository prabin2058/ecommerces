import { useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useAsync, useDocumentTitle } from "@store/shared";
import { adminApi } from "../api";
import { errorMessage, errorDetails } from "@store/shared";
import { isAdmin } from "../redux/authSlice";
import { PageHeader } from "../layouts/AdminLayout";
import { Button, Modal, Field, Input, Select, Checkbox, PageLoader, Badge } from "@store/shared";

export default function Categories() {
  useDocumentTitle("Categories");
  const { user } = useSelector((s) => s.auth);
  const { data: cats = [], loading, reload } = useAsync(() => adminApi.categories(), []);
  const [edit, setEdit] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      if (edit.id) await adminApi.updateCategory(edit.id, edit);
      else await adminApi.createCategory(edit);
      toast.success("Category saved");
      setEdit(null);
      reload({ silent: true });
    } catch (e) {
      setErrors(errorDetails(e));
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (c) => {
    try {
      await adminApi.deleteCategory(c.id);
      toast.success("Deleted");
      reload({ silent: true });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  if (loading) return <PageLoader />;
  const roots = cats.filter((c) => !c.parent);
  const row = (c, child) => (
    <tr key={c.id} className="hover:bg-gray-50">
      <td className={`px-5 py-3 ${child ? "pl-10" : ""}`}><div className="font-medium">{child && "↳ "}{c.name}</div><div className="font-mono text-xs text-ink-muted">/{c.slug}</div></td>
      <td className="px-3 py-3 tabular-nums">{c.productCount}</td>
      <td className="px-3 py-3">{c.isActive ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
      <td className="px-5 py-3 text-right">
        <Button size="sm" variant="ghost" onClick={() => { setErrors({}); setEdit({ ...c, parent: c.parent || "" }); }}>Edit</Button>
        {isAdmin(user) && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(c)}>Delete</Button>}
      </td>
    </tr>
  );
  return (
    <>
      <PageHeader title="Categories" description="Customers browse by these. A category with products can be deactivated but not deleted." actions={<Button onClick={() => { setErrors({}); setEdit({ name: "", slug: "", parent: "", isActive: true, description: "" }); }}>Add category</Button>} />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-5 py-3">Name</th><th className="px-3 py-3">Products</th><th className="px-3 py-3">Status</th><th /></tr></thead>
          <tbody className="divide-y divide-gray-100">{roots.flatMap((r) => [row(r), ...cats.filter((c) => String(c.parent) === r.id).map((c) => row(c, true))])}</tbody>
        </table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit category" : "New category"}
        footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Name" error={errors.name} required><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} error={errors.name} /></Field>
            <Field label="Slug" hint="Leave empty to generate from the name"><Input value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} className="font-mono" /></Field>
            <Field label="Parent category" error={errors.parent}>
              <Select value={edit.parent} onChange={(e) => setEdit({ ...edit, parent: e.target.value })}>
                <option value="">None (top level)</option>
                {roots.filter((r) => r.id !== edit.id).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </Field>
            <Checkbox label="Active (visible in the store)" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />
          </div>
        )}
      </Modal>
    </>
  );
}
