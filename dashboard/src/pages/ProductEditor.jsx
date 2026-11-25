import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { HiCheckCircle, HiOutlineExclamationCircle, HiOutlineArrowTopRightOnSquare, HiOutlineDocumentDuplicate, HiOutlineArchiveBox, HiOutlineTrash, HiOutlineCalendar } from "react-icons/hi2";
import { useAsync, useDocumentTitle } from "@store/shared";
import { adminApi } from "../api";
import { errorMessage, errorDetails } from "@store/shared";
import { toPaisa, toRupees, money, dateTime } from "@store/shared";
import { isAdmin } from "../redux/authSlice";
import { PageHeader } from "../layouts/AdminLayout";
import { Button, Field, Input, Select, Checkbox, PageLoader, StatusBadge, Alert, Modal, Confirm, Badge } from "@store/shared";
import RichText from "../components/RichText";
import { STORE_URL } from "../config";
import ImageManager from "../components/ImageManager";
import VariantsEditor from "../components/VariantsEditor";

 
function Section({ title, description, children, aside }) {
  return (
    <section className="card">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div><h2 className="text-sm font-semibold">{title}</h2>{description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}</div>
        {aside}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const toForm = (p) => ({
  name: p?.name || "", slug: p?.slug || "", description: p?.description || "", brand: p?.brand || "",
  categories: (p?.categories || []).map((c) => c._id || c.id || c), basePrice: toRupees(p?.basePrice), compareAtPrice: toRupees(p?.compareAtPrice),
  costPrice: toRupees(p?.costPrice), taxClass: p?.taxClass || "standard", weightGrams: p?.weightGrams ? String(p.weightGrams) : "",
  length: p?.dimensionsCm?.length ?? "", width: p?.dimensionsCm?.width ?? "", height: p?.dimensionsCm?.height ?? "",
  allowBackorder: !!p?.allowBackorder, featured: !!p?.featured, seoTitle: p?.seoTitle || "", seoDescription: p?.seoDescription || "",
  sku: "", stock: "",
});

function toPayload(f, isNew) {
  const out = {
    name: f.name, description: f.description, brand: f.brand, categories: f.categories, basePrice: toPaisa(f.basePrice),
    compareAtPrice: f.compareAtPrice === "" ? null : toPaisa(f.compareAtPrice), costPrice: f.costPrice === "" ? null : toPaisa(f.costPrice),
    taxClass: f.taxClass, weightGrams: f.weightGrams === "" ? 0 : Number(f.weightGrams), allowBackorder: f.allowBackorder, featured: f.featured,
    seoTitle: f.seoTitle, seoDescription: f.seoDescription,
    dimensionsCm: { length: Number(f.length) || undefined, width: Number(f.width) || undefined, height: Number(f.height) || undefined },
  };
  if (!isNew && f.slug) out.slug = f.slug;
  if (isNew) Object.assign(out, { sku: f.sku, stock: f.stock === "" ? 0 : Number(f.stock) });
  return out;
}

function validate(f, isNew) {
  const e = {};
  if (f.name.trim().length < 3 || f.name.length > 150) e.name = "Name must be 3–150 characters";
  if (!(Number(f.basePrice) > 0)) e.basePrice = "Price must be greater than 0";
  if (f.compareAtPrice !== "" && Number(f.compareAtPrice) <= Number(f.basePrice)) e.compareAtPrice = "Must be greater than the price";
  if (isNew && !f.sku.trim()) e.sku = "SKU is required";
  if (isNew && f.stock !== "" && (!Number.isInteger(Number(f.stock)) || Number(f.stock) < 0)) e.stock = "Whole number, 0 or more";
  return e;
}

export default function ProductEditor() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { user } = useSelector((s) => s.auth);
  const { data: loaded, loading, setData: setProduct } = useAsync(() => (isNew ? Promise.resolve(null) : adminApi.product(id)), [id]);
  const product = loaded;
  const { data: cats = [] } = useAsync(() => adminApi.categories(), []);
  const { data: check, reload: recheck } = useAsync(() => (isNew ? Promise.resolve({ issues: [] }) : adminApi.publishCheck(id)), [id, product?.updatedAt, product?.images?.length, product?.variants?.length]);
  const [f, setF] = useState(toForm(null));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const [publishAt, setPublishAt] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  useDocumentTitle(isNew ? "New product" : product?.name);

  useEffect(() => {
    if (product || isNew) setF(toForm(product));
  }, [product, isNew]);

  const initial = useMemo(() => JSON.stringify(toForm(product)), [product]);
  const dirty = JSON.stringify(f) !== initial;
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e });

  const onProduct = (p) => {
    setProduct(p);
    recheck({ silent: true });
  };

  const save = async () => {
    const e = validate(f, isNew);
    setErrors(e);
    if (Object.keys(e).length) return toast.error("Please fix the highlighted fields");
    setSaving(true);
    try {
      if (isNew) {
        const p = await adminApi.createProduct(toPayload(f, true));
        toast.success("Draft created — now add images and variants");
        navigate(`/products/${p.id}`, { replace: true });
      } else {
        onProduct(await adminApi.updateProduct(id, toPayload(f, false)));
        toast.success("Saved");
      }
    } catch (err) {
      const d = errorDetails(err);
      setErrors(d);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const act = async (fn, msg) => {
    try {
      const p = await fn();
      if (p?.id) onProduct(p);
      if (msg) toast.success(msg);
      return p;
    } catch (err) {
      toast.error(errorMessage(err), { autoClose: 6000 });
    }
  };

  if (loading) return <PageLoader />;
  if (!isNew && !product) return <Alert tone="error">Product not found.</Alert>;
  const issues = check?.issues || [];
  const margin = f.costPrice && f.basePrice ? Math.round(((f.basePrice - f.costPrice) / f.basePrice) * 100) : null;

  return (
    <div className="pb-24">
      <PageHeader back={{ to: "/products", label: "Products" }} title={isNew ? "Add product" : product.name}
        description={!isNew && <span className="flex items-center gap-2">{product.status === "draft" && product.publishAt ? <Badge tone="blue">Scheduled · {dateTime(product.publishAt)}</Badge> : <StatusBadge status={product.status} />} Last updated {dateTime(product.updatedAt)}</span>}
        actions={!isNew && (
          <>
            {product.status === "active" && <a href={`${STORE_URL}/products/${product.slug}`} target="_blank" rel="noreferrer" className="btn-outline"><HiOutlineArrowTopRightOnSquare /> View</a>}
            <Button variant="outline" onClick={async () => { const p = await act(() => adminApi.duplicate(id), "Duplicated as a draft"); if (p) navigate(`/products/${p.id}`); }}><HiOutlineDocumentDuplicate /> Duplicate</Button>
            {product.status !== "archived" && <Button variant="outline" onClick={() => act(() => adminApi.archive(id), "Archived — hidden from the store")}><HiOutlineArchiveBox /> Archive</Button>}
            {product.status === "active" ? (
              <Button variant="outline" onClick={() => act(() => adminApi.unpublish(id), "Moved to draft")}>Unpublish</Button>
            ) : (
              <>
                <Button variant="outline" disabled={issues.length > 0 || dirty} onClick={() => setSchedule(true)}><HiOutlineCalendar /> Schedule</Button>
                <Button variant="brand" disabled={issues.length > 0 || dirty} title={dirty ? "Save your changes first" : issues[0]} onClick={() => act(() => adminApi.publish(id), "Published — it’s live")}>Publish</Button>
              </>
            )}
          </>
        )} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Section title="Basic details">
            <div className="space-y-4">
              <Field label="Name" required error={errors.name} hint={`${f.name.length}/150`}><Input value={f.name} onChange={set("name")} error={errors.name} maxLength={150} /></Field>
              {!isNew && (
                <Field label="URL handle (slug)" error={errors.slug} hint="Used in the product URL. Lowercase letters, numbers and dashes.">
                  <div className="flex items-center rounded-xl border border-gray-300 shadow-sm focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
                    <span className="pl-3.5 text-sm text-ink-muted">/products/</span>
                    <input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className="flex-1 rounded-r-xl bg-transparent py-2.5 pr-3 text-sm focus:outline-none" aria-label="Slug" />
                  </div>
                </Field>
              )}
              <Field label="Description" required error={errors.description}><RichText value={f.description} onChange={(v) => setF((x) => ({ ...x, description: v }))} invalid={!!errors.description} /></Field>
            </div>
          </Section>

          {!isNew && (
            <Section title="Media" description="At least one image is required to publish.">
              <ImageManager product={product} onChange={onProduct} />
            </Section>
          )}

          <Section title="Pricing" description="Prices in Nepali rupees. Variants can override the price.">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Price" required error={errors.basePrice}><Input type="number" min="1" step="1" value={f.basePrice} onChange={set("basePrice")} error={errors.basePrice} /></Field>
              <Field label="Compare-at price" error={errors.compareAtPrice} hint="Shows as a discount"><Input type="number" min="0" step="1" value={f.compareAtPrice} onChange={set("compareAtPrice")} error={errors.compareAtPrice} /></Field>
              <Field label="Cost per item" hint={margin !== null ? `Margin ${margin}% · admin only` : "Admin only, for margin reports"}><Input type="number" min="0" step="1" value={f.costPrice} onChange={set("costPrice")} /></Field>
            </div>
          </Section>

          {isNew ? (
            <Section title="Inventory" description="You can add options like size and colour after saving.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="SKU" required error={errors.sku}><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value.toUpperCase() })} className="font-mono" error={errors.sku} placeholder="TEE-BLK-M" /></Field>
                <Field label="Starting stock" error={errors.stock}><Input type="number" min="0" step="1" value={f.stock} onChange={set("stock")} error={errors.stock} placeholder="0" /></Field>
              </div>
            </Section>
          ) : (
            <Section title="Variants & inventory" description="Options generate one variant per combination. Click a stock number to adjust it — every change is logged.">
              <VariantsEditor product={product} onChange={onProduct} />
            </Section>
          )}

          <Section title="Shipping">
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Weight (g)" hint="Used for shipping rates"><Input type="number" min="0" value={f.weightGrams} onChange={set("weightGrams")} /></Field>
              <Field label="Length (cm)"><Input type="number" min="0" value={f.length} onChange={set("length")} /></Field>
              <Field label="Width (cm)"><Input type="number" min="0" value={f.width} onChange={set("width")} /></Field>
              <Field label="Height (cm)"><Input type="number" min="0" value={f.height} onChange={set("height")} /></Field>
            </div>
          </Section>

          <Section title="Search engine listing">
            <div className="mb-4 rounded-xl bg-gray-50 p-4">
              <div className="text-xs text-emerald-700">prabin.store › products › {f.slug || "…"}</div>
              <div className="mt-0.5 truncate text-lg text-[#1a0dab]">{f.seoTitle || f.name || "Product title"}</div>
              <div className="line-clamp-2 text-sm text-ink-soft">{f.seoDescription || f.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "Description preview"}</div>
            </div>
            <div className="space-y-4">
              <Field label="SEO title" hint={`${(f.seoTitle || f.name).length}/70 · defaults to the product name`}><Input value={f.seoTitle} maxLength={70} onChange={set("seoTitle")} placeholder={f.name} /></Field>
              <Field label="Meta description" hint={`${f.seoDescription.length}/160 · defaults to the first 160 characters of the description`}>
                <textarea className="input min-h-20" maxLength={160} value={f.seoDescription} onChange={set("seoDescription")} />
              </Field>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          {!isNew && (
            <Section title="Publishing checklist">
              {issues.length === 0 ? (
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700"><HiCheckCircle className="h-5 w-5" /> Ready to publish</div>
              ) : (
                <ul className="space-y-2">
                  {issues.map((i) => <li key={i} className="flex gap-2 text-sm text-ink-soft"><HiOutlineExclamationCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> {i}</li>)}
                </ul>
              )}
              {dirty && <p className="mt-3 text-xs text-amber-700">Save your changes before publishing.</p>}
            </Section>
          )}
          <Section title="Organization">
            <div className="space-y-4">
              <Field label="Categories" required error={errors.categories} hint="At least one active category to publish">
                <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-gray-200 p-3">
                  {cats.map((c) => (
                    <Checkbox key={c.id} className={c.parent ? "pl-5" : ""} label={<>{c.name}{!c.isActive && <span className="ml-1 text-xs text-ink-muted">(inactive)</span>}</>}
                      checked={f.categories.includes(c.id)} onChange={() => setF({ ...f, categories: f.categories.includes(c.id) ? f.categories.filter((x) => x !== c.id) : [...f.categories, c.id] })} />
                  ))}
                  {!cats.length && <Link to="/categories" className="link text-sm">Create a category first</Link>}
                </div>
              </Field>
              <Field label="Brand"><Input value={f.brand} onChange={set("brand")} list="brand-list" /></Field>
              <Field label="Tax class">
                <Select value={f.taxClass} onChange={set("taxClass")}><option value="standard">Standard (13% VAT)</option><option value="reduced">Reduced (5%)</option><option value="exempt">Exempt</option></Select>
              </Field>
              <Checkbox label="Feature on the homepage" checked={f.featured} onChange={set("featured")} />
              <Checkbox label="Allow backorders when out of stock" checked={f.allowBackorder} onChange={set("allowBackorder")} />
            </div>
          </Section>
          {!isNew && isAdmin(user) && (
            <Section title="Danger zone">
              <p className="mb-3 text-xs text-ink-muted">Products that appear in orders can’t be deleted — archive them instead.</p>
              <Button variant="outline" className="w-full text-red-600" onClick={() => setConfirmDelete(true)}><HiOutlineTrash /> Delete product</Button>
            </Section>
          )}
        </div>
      </div>

      {(dirty || isNew) && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <span className="mr-auto text-sm text-ink-muted">{isNew ? "New product will be saved as a draft" : "Unsaved changes"}</span>
            {!isNew && <Button variant="outline" onClick={() => setF(toForm(product))}>Discard</Button>}
            <Button loading={saving} onClick={save}>{isNew ? "Save draft" : "Save"}</Button>
          </div>
        </div>
      )}

      <Modal open={schedule} onClose={() => setSchedule(false)} title="Schedule publish" size="sm"
        footer={<><Button variant="outline" onClick={() => setSchedule(false)}>Cancel</Button><Button disabled={!publishAt} onClick={async () => { await act(() => adminApi.publish(id, { publishAt: new Date(publishAt).toISOString() }), "Scheduled"); setSchedule(false); }}>Schedule</Button></>}>
        <Field label="Go live at" hint="Uses your local time. The product stays a draft until then."><Input type="datetime-local" value={publishAt} min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} onChange={(e) => setPublishAt(e.target.value)} /></Field>
      </Modal>
      <Confirm open={confirmDelete} onClose={() => setConfirmDelete(false)} danger title="Delete product?" confirmLabel="Delete permanently"
        message={`“${product?.name}” and its variants will be permanently deleted. This can’t be undone.`}
        onConfirm={async () => { try { await adminApi.deleteProduct(id); toast.success("Deleted"); navigate("/products"); } catch (e) { toast.error(errorMessage(e)); setConfirmDelete(false); } }} />
      <datalist id="brand-list">{["Prabin Basics", "Himal Thread", "Sonora", "Pulse", "Trail & Co", "Stride", "Green Corner"].map((b) => <option key={b} value={b} />)}</datalist>
      {!isNew && <p className="mt-6 text-xs text-ink-muted">Price range: {money(product.priceMin)} – {money(product.priceMax)} · {product.stock} available across active variants</p>}
    </div>
  );
}
