import { useState } from "react";
import { toast } from "react-toastify";
import { useAsync, useDebounced, useDocumentTitle } from "@store/shared";
import { adminApi } from "../api";
import { errorMessage } from "@store/shared";
import { date } from "@store/shared";
import { PageHeader } from "../layouts/AdminLayout";
import { Input, Badge, Spinner } from "@store/shared";

const ROLES = [["CATALOG_MANAGER", "Catalog manager", "Create and edit products, stock, categories"], ["ADMIN", "Admin", "Everything, incl. orders, refunds, coupons, bulk prices, deletes"]];

export default function Users() {
  useDocumentTitle("Staff & roles");
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const { data: users, loading, setData } = useAsync(() => adminApi.users({ q: dq }), [dq]);
  const toggle = async (u, role) => {
    const roles = u.roles.includes(role) ? u.roles.filter((r) => r !== role) : [...u.roles, role];
    try {
      const r = await adminApi.setRoles(u.id, roles);
      setData(users.map((x) => (x.id === u.id ? { ...x, roles: r.roles } : x)));
      toast.success("Roles updated");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      <PageHeader title="Staff & roles" description="Role permissions are checked on every request by the API." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {ROLES.map(([k, l, d]) => <div key={k} className="card p-4 text-sm"><div className="font-semibold">{l}</div><div className="text-xs text-ink-muted">{d}</div></div>)}
      </div>
      <div className="card">
        <div className="border-b border-gray-100 p-3"><Input className="max-w-sm" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {loading && !users ? <div className="flex justify-center py-10"><Spinner /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-5 py-2">User</th><th className="px-3 py-2">Joined</th><th className="px-3 py-2">2FA</th>{ROLES.map(([k, l]) => <th key={k} className="px-3 py-2">{l}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {users?.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3"><div className="font-medium">{u.name}</div><div className="text-xs text-ink-muted">{u.email}</div></td>
                    <td className="px-3 py-3 text-xs text-ink-muted">{date(u.createdAt)}</td>
                    <td className="px-3 py-3">{u.twoFactorEnabled ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}</td>
                    {ROLES.map(([k]) => (
                      <td key={k} className="px-3 py-3"><input type="checkbox" aria-label={`${k} for ${u.email}`} checked={u.roles.includes(k)} onChange={() => toggle(u, k)} className="rounded border-gray-300" /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
