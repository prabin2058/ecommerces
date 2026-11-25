import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { HiOutlineArrowDownTray, HiOutlineArrowUpTray, HiCheckCircle, HiXCircle } from "react-icons/hi2";
import { adminApi } from "../api";
import { errorMessage } from "@store/shared";
import { useDocumentTitle } from "@store/shared";
import { PageHeader } from "../layouts/AdminLayout";
import { Button, Alert, Badge } from "@store/shared";

function download(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportExport() {
  useDocumentTitle("Import / export");
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async (dryRun) => {
    setBusy(true);
    try {
      const r = await adminApi.importCsv(text, dryRun);
      setResult(r);
      if (!dryRun && r.ok) toast.success(`Imported ${r.summary.products} products`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const pick = async (f) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("CSV must be 5 MB or less");
    setFile(f);
    setText(await f.text());
    setResult(null);
  };
  return (
    <>
      <PageHeader title="Import / export" description="Bulk-edit your catalog in a spreadsheet. Rows with the same handle are variants of one product." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-semibold">Export products</h2>
          <p className="mt-1 text-sm text-ink-muted">Download every product and variant as CSV, with prices in rupees and current stock.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" onClick={async () => download(await adminApi.exportCsv(), `products-${new Date().toISOString().slice(0, 10)}.csv`)}><HiOutlineArrowDownTray /> Export CSV</Button>
            <Button variant="ghost" onClick={async () => download(await adminApi.template(), "product-import-template.csv")}>Download template</Button>
          </div>
        </div>
        <div className="card p-6">
          <h2 className="font-semibold">Import products</h2>
          <p className="mt-1 text-sm text-ink-muted">Always previewed first: nothing changes until you confirm. Existing SKUs are updated; new ones are created as drafts unless status says otherwise.</p>
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}
            className="mt-5 flex flex-col items-center rounded-xl border-2 border-dashed border-gray-300 p-6 text-center">
            <HiOutlineArrowUpTray className="h-7 w-7 text-ink-muted" />
            <div className="mt-2 text-sm">{file ? <b>{file.name}</b> : "Drop a CSV here or"}</div>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => input.current?.click()}>{file ? "Choose another" : "Choose file"}</Button>
            <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = ""; }} />
          </div>
          {text && <Button className="mt-4 w-full" loading={busy} onClick={() => run(true)}>Preview import (dry run)</Button>}
        </div>
      </div>

      {result && (
        <div className="card mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="font-semibold">{result.dryRun ? "Preview" : "Import complete"}</h2>
              {result.summary && <p className="text-sm text-ink-muted">{result.summary.rows} rows · {result.summary.products} products · {result.summary.variants} variants · <span className={result.summary.errors ? "font-semibold text-red-600" : ""}>{result.summary.errors} errors</span></p>}
            </div>
            {result.dryRun && result.ok && <Button variant="brand" loading={busy} onClick={() => run(false)}>Import {result.summary.variants} rows</Button>}
          </div>
          {result.fatal && <Alert tone="error" className="m-5">{result.fatal}</Alert>}
          {result.dryRun && !result.ok && !result.fatal && <Alert tone="error" className="m-5">Fix the rows below in your spreadsheet and upload again. Nothing was imported.</Alert>}
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-ink-muted"><tr><th className="px-5 py-2">Row</th><th className="px-3 py-2">Handle</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Action</th><th className="px-5 py-2">Details</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {result.rows.map((r) => (
                  <tr key={r.row} className={r.errors.length ? "bg-red-50/50" : ""}>
                    <td className="px-5 py-2 tabular-nums text-ink-muted">{r.row}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.handle}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                    <td className="px-3 py-2">{r.errors.length ? <span className="flex items-center gap-1 text-red-600"><HiXCircle /> Error</span> : <span className="flex items-center gap-1 text-emerald-700"><HiCheckCircle /> <Badge tone={r.action === "create" ? "green" : "blue"}>{r.action}</Badge></span>}</td>
                    <td className="px-5 py-2 text-xs">{r.errors.join("; ")}{r.warnings?.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
