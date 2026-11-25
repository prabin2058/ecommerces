import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useAsync, useDocumentTitle } from "@store/shared";
import { adminApi } from "../api";
import { dateTime } from "@store/shared";
import { PageHeader } from "../layouts/AdminLayout";
import { Pagination, Badge, Button, Select, Spinner } from "@store/shared";

const fmt = (v) => (v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

export default function Activity() {
  useDocumentTitle("Activity");
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "audit";
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState("");
  const [open, setOpen] = useState(null);
  const { data, loading, reload } = useAsync(() => adminApi.activity({ type: tab === "notifications" ? "notifications" : "audit", page, channel, limit: 40 }), [tab, page, channel]);
  return (
    <>
      <PageHeader title="Activity" description="Audit trail of every catalog change, plus the outbox of emails, SMS and admin alerts."
        actions={tab === "notifications" && <Button variant="outline" onClick={async () => { await adminApi.markRead(); toast.success("Alerts marked read"); reload({ silent: true }); }}>Mark alerts read</Button>} />
      <div className="mb-4 flex gap-2">
        {[["audit", "Audit log"], ["notifications", "Notifications"]].map(([k, l]) => (
          <button key={k} onClick={() => { setParams({ tab: k }); setPage(1); }} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === k ? "bg-ink text-white" : "bg-white text-ink-soft ring-1 ring-gray-200 hover:bg-gray-50"}`}>{l}</button>
        ))}
        {tab === "notifications" && (
          <Select className="!ml-auto !w-auto !py-1.5" value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} aria-label="Channel">
            <option value="">All channels</option><option value="email">Email</option><option value="sms">SMS</option><option value="admin">Admin alerts</option>
          </Select>
        )}
      </div>
      <div className="card overflow-x-auto">
        {loading && !data ? <div className="flex justify-center py-10"><Spinner /></div> : tab === "audit" ? (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-5 py-3">When</th><th className="px-3 py-3">Who</th><th className="px-3 py-3">What</th><th className="px-5 py-3">Changes</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data?.items.map((a) => (
                <tr key={a._id} className="align-top">
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-ink-muted">{dateTime(a.createdAt)}</td>
                  <td className="px-3 py-3">{a.userName}</td>
                  <td className="px-3 py-3"><Badge>{a.entity}</Badge> <span className="font-medium">{a.action}</span><div className="font-mono text-[11px] text-ink-muted">{a.entityId}</div></td>
                  <td className="px-5 py-3 text-xs">
                    {a.changes.slice(0, 4).map((c, i) => (
                      <div key={i} className="max-w-xl truncate"><b>{c.field}</b>: <span className="text-red-600 line-through">{fmt(c.old).slice(0, 60)}</span> → <span className="text-emerald-700">{fmt(c.new).slice(0, 80)}</span></div>
                    ))}
                    {a.changes.length > 4 && <div className="text-ink-muted">+{a.changes.length - 4} more</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-5 py-3">When</th><th className="px-3 py-3">Channel</th><th className="px-3 py-3">To</th><th className="px-5 py-3">Subject</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data?.items.map((n) => (
                <tr key={n._id} className="cursor-pointer align-top hover:bg-gray-50" onClick={() => setOpen(open === n._id ? null : n._id)}>
                  <td className="whitespace-nowrap px-5 py-3 text-xs text-ink-muted">{dateTime(n.createdAt)}</td>
                  <td className="px-3 py-3"><Badge tone={n.channel === "admin" ? (n.severity === "critical" ? "red" : n.severity === "warning" ? "yellow" : "blue") : "gray"}>{n.channel}</Badge>{n.channel === "admin" && !n.read && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-brand-600" />}</td>
                  <td className="px-3 py-3 text-xs">{n.to || "staff"}</td>
                  <td className="px-5 py-3"><div className="font-medium">{n.subject}</div>{open === n._id && n.body && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-sans text-xs text-ink-soft">{n.body}</pre>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="border-t border-gray-100 p-3"><Pagination page={page} pages={data?.pages} onChange={setPage} /></div>
      </div>
    </>
  );
}
