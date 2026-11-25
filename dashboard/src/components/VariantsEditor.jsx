import { useState } from "react";
import { toast } from "react-toastify";
import { HiXMark, HiPlus, HiOutlineAdjustmentsVertical } from "react-icons/hi2";
import { adminApi } from "../api";
import { errorMessage } from "@store/shared";
import { toPaisa, toRupees, dateTime } from "@store/shared";
import { Button, Input, Modal, Field, Select, Confirm } from "@store/shared";
import { useAsync } from "@store/shared";

function OptionsEditor({ product, onChange }) {
  const [opts, setOpts] = useState(product.options.map((o) => ({ ...o, draft: "" })));
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const count = opts.filter((o) => o.name && o.values.length).reduce((n, o) => n * o.values.length, 1);
  const changed = JSON.stringify(opts.map(({ name, values }) => ({ name, values }))) !== JSON.stringify(product.options.map(({ name, values }) => ({ name, values })));
  const addValue = (i) => {
    const o = opts[i];
    const vals = o.draft.split(",").map((s) => s.trim()).filter((s) => s && !o.values.includes(s));
    if (!vals.length) return;
    setOpts(opts.map((x, k) => (k === i ? { ...x, values: [...x.values, ...vals], draft: "" } : x)));
  };
  const save = async () => {
    setBusy(true);
    try {
      onChange(await adminApi.setOptions(product.id, opts.map(({ name, values }) => ({ name, values }))));
      toast.success("Variants updated");
      setConfirm(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      {opts.map((o, i) => (
        <div key={i} className="rounded-xl border border-gray-200 p-3">
          <div className="flex gap-2">
            <Input value={o.name} onChange={(e) => setOpts(opts.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} placeholder="Option name (e.g. Size)" className="!w-48" aria-label="Option name" />
            <button type="button" className="btn-ghost btn-sm ml-auto text-red-600" onClick={() => setOpts(opts.filter((_, k) => k !== i))}>Remove option</button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {o.values.map((v) => (
              <span key={v} className="chip bg-gray-100 py-1 text-ink">{v}
                <button type="button" aria-label={`Remove ${v}`} onClick={() => setOpts(opts.map((x, k) => (k === i ? { ...x, values: x.values.filter((y) => y !== v) } : x)))}><HiXMark /></button>
              </span>
            ))}
            <input value={o.draft} onChange={(e) => setOpts(opts.map((x, k) => (k === i ? { ...x, draft: e.target.value } : x)))}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addValue(i); } }} onBlur={() => addValue(i)}
              placeholder="Add values, press Enter" className="min-w-40 flex-1 rounded-lg border border-dashed border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none" aria-label="Add option values" />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {opts.length < 3 && <Button type="button" size="sm" variant="outline" onClick={() => setOpts([...opts, { name: "", values: [], draft: "" }])}><HiPlus /> Add option</Button>}
        {changed && <Button type="button" size="sm" onClick={() => setConfirm(true)}>Generate {count} variant{count === 1 ? "" : "s"}</Button>}
        {changed && <button type="button" className="text-xs text-ink-muted hover:text-ink" onClick={() => setOpts(product.options.map((o) => ({ ...o, draft: "" })))}>Discard</button>}
      </div>
      <Confirm open={confirm} onClose={() => setConfirm(false)} onConfirm={save} loading={busy} title="Regenerate variants?" confirmLabel="Generate"
        message={`This creates one variant per combination (${count} total). Existing combinations keep their SKU, price and stock; combinations you removed are deactivated (kept for past orders).`} />
    </div>
  );
}

function StockModal({ variant, onClose, onDone }) {
  const [change, setChange] = useState("");
  const [reason, setReason] = useState("restock");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: logs } = useAsync(() => adminApi.inventoryLogs({ variant: variant.id, limit: 8 }), [variant.id]);
  const n = Number(change);
  const submit = async () => {
    setBusy(true);
    try {
      await adminApi.adjustStock(variant.id, { change: n, reason, note });
      toast.success("Stock updated");
      onDone();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Adjust stock · ${variant.sku}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!Number.isInteger(n) || n === 0 || variant.available + n < 0} onClick={submit}>Save</Button></>}>
      <div className="mb-5 grid grid-cols-3 gap-3 text-center">
        {[["On hand", variant.onHand], ["Reserved", variant.reserved], ["Available", variant.available]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-gray-50 p-3"><div className="text-xl font-bold tabular-nums">{v}</div><div className="text-xs text-ink-muted">{l}</div></div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Change" hint={Number.isInteger(n) && n ? `New on hand: ${variant.onHand + n}` : "e.g. 10 to add, -2 to remove"} error={variant.available + n < 0 ? "Can’t remove reserved stock" : null}>
          <Input type="number" step="1" value={change} onChange={(e) => setChange(e.target.value)} autoFocus />
        </Field>
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="restock">Restock</option><option value="manual_adjust">Manual adjustment / count</option><option value="damaged">Damaged / lost</option><option value="return">Customer return</option>
          </Select>
        </Field>
        <Field label="Note (optional)" className="sm:col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="PO number, supplier…" /></Field>
      </div>
      {logs?.items?.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Recent history</div>
          <ul className="divide-y divide-gray-100 text-xs">
            {logs.items.map((l) => (
              <li key={l._id} className="flex justify-between gap-2 py-2">
                <span><b className={l.change > 0 ? "text-emerald-600" : "text-red-600"}>{l.change > 0 ? "+" : ""}{l.change}</b> {l.field === "reserved" ? "reserved" : "on hand"} · {l.reason.replace("_", " ")}{l.note ? ` · ${l.note}` : ""}{l.refId ? ` · ${l.refId}` : ""}</span>
                <span className="shrink-0 text-ink-muted">{l.user?.name || "system"} · {dateTime(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

function VariantRow({ v, productId, onSaved, onStock }) {
  const init = { sku: v.sku, price: toRupees(v.price), compareAtPrice: toRupees(v.compareAtPrice), lowStockThreshold: String(v.lowStockThreshold) };
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(init);
  const save = async (extra = {}) => {
    setBusy(true);
    try {
      await adminApi.updateVariant(v.id, { sku: f.sku, price: toPaisa(f.price), compareAtPrice: f.compareAtPrice === "" ? null : toPaisa(f.compareAtPrice), lowStockThreshold: Number(f.lowStockThreshold), ...extra });
      onSaved(await adminApi.product(productId));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const cell = "px-2 py-2";
  return (
    <tr className={v.isActive ? "" : "bg-gray-50 text-ink-muted"}>
      <td className={`${cell} pl-4 font-medium`}>{v.label}</td>
      <td className={cell}><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value.toUpperCase() })} className="!w-40 !py-1.5 font-mono text-xs" aria-label="SKU" /></td>
      <td className={cell}><Input type="number" min="1" step="1" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className="!w-28 !py-1.5" aria-label="Price (Rs)" /></td>
      <td className={cell}><Input type="number" min="0" step="1" value={f.compareAtPrice} onChange={(e) => setF({ ...f, compareAtPrice: e.target.value })} className="!w-28 !py-1.5" placeholder="—" aria-label="Compare-at price (Rs)" /></td>
      <td className={cell}>
        <button type="button" onClick={onStock} className="group flex items-center gap-1.5 rounded-lg px-2 py-1 hover:bg-gray-100" title="Adjust stock">
          <span className={`font-semibold tabular-nums ${v.available <= 0 ? "text-red-600" : v.available <= v.lowStockThreshold ? "text-amber-600" : ""}`}>{v.available}</span>
          <span className="text-xs text-ink-muted">({v.onHand} / {v.reserved} res.)</span>
          <HiOutlineAdjustmentsVertical className="text-ink-muted group-hover:text-ink" />
        </button>
      </td>
      <td className={cell}><Input type="number" min="0" value={f.lowStockThreshold} onChange={(e) => setF({ ...f, lowStockThreshold: e.target.value })} className="!w-16 !py-1.5" aria-label="Low stock threshold" /></td>
      <td className={cell}>
        <label className="inline-flex cursor-pointer items-center gap-2 text-xs">
          <input type="checkbox" checked={v.isActive} onChange={(e) => save({ isActive: e.target.checked })} className="rounded border-gray-300" /> Active
        </label>
      </td>
      <td className={`${cell} pr-4 text-right`}>{dirty && <Button size="sm" loading={busy} onClick={() => save()}>Save</Button>}</td>
    </tr>
  );
}

export default function VariantsEditor({ product, onChange }) {
  const [stockFor, setStockFor] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const variants = product.variants.filter((v) => showInactive || v.isActive);
  const inactive = product.variants.filter((v) => !v.isActive).length;
  return (
    <div className="space-y-5">
      <OptionsEditor key={JSON.stringify(product.options)} product={product} onChange={onChange} />
      <div className="-mx-5 overflow-x-auto border-t border-gray-100">
        <table className="w-full text-sm">
          <thead className="text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
            <tr><th className="px-2 py-2 pl-4">Variant</th><th className="px-2 py-2">SKU</th><th className="px-2 py-2">Price (Rs)</th><th className="px-2 py-2">Compare-at</th><th className="px-2 py-2">Available</th><th className="px-2 py-2">Low at</th><th className="px-2 py-2" /><th /></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {variants.map((v) => <VariantRow key={`${v.id}-${v.updatedAt}`} v={v} productId={product.id} onSaved={onChange} onStock={() => setStockFor(v)} />)}
          </tbody>
        </table>
      </div>
      {inactive > 0 && <button type="button" className="text-xs font-medium text-ink-muted hover:text-ink" onClick={() => setShowInactive(!showInactive)}>{showInactive ? "Hide" : "Show"} {inactive} inactive variant{inactive === 1 ? "" : "s"}</button>}
      {stockFor && <StockModal variant={stockFor} onClose={() => setStockFor(null)} onDone={async () => { setStockFor(null); onChange(await adminApi.product(product.id)); }} />}
    </div>
  );
}
