import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { HiOutlinePhoto, HiOutlineTrash, HiArrowsUpDown } from "react-icons/hi2";
import { adminApi } from "../api";
import { errorMessage } from "@store/shared";
import { Spinner, sized } from "@store/shared";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function ImageManager({ product, onChange }) {
  const input = useRef(null);
  const [uploads, setUploads] = useState([]);
  const [dragIdx, setDragIdx] = useState(null);
  const [images, setImages] = useState(product.images);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!dirty && images !== product.images) setImages(product.images);

  const upload = async (files) => {
    for (const file of files) {
      if (!TYPES.includes(file.type)) { toast.error(`${file.name}: use JPG, PNG or WebP`); continue; }
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name}: images must be 5 MB or less`); continue; }
      const id = `${file.name}-${Date.now()}`;
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
      try {
        // 1) ask for a pre-signed URL, 2) send bytes straight to storage, 3) attach to product.
        const { uploadUrl } = await adminApi.presign(file);
        const { url } = await adminApi.upload(uploadUrl, file, (p) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x))));
        const updated = await adminApi.attachImage(product.id, { url, altText: product.name });
        onChange(updated);
        setDirty(false);
      } catch (e) {
        toast.error(`${file.name}: ${errorMessage(e)}`);
      } finally {
        setUploads((u) => u.filter((x) => x.id !== id));
      }
    }
  };

  const persist = async (next) => {
    setSaving(true);
    try {
      const updated = await adminApi.updateImages(product.id, next.map((i) => ({ id: i._id, altText: i.altText, variant: i.variant })));
      onChange(updated);
      setDirty(false);
    } catch (e) {
      toast.error(errorMessage(e));
      setImages(product.images);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const onDrop = (to) => {
    if (dragIdx === null || dragIdx === to) return;
    const next = [...images];
    const [m] = next.splice(dragIdx, 1);
    next.splice(to, 0, m);
    setImages(next);
    setDragIdx(null);
    persist(next);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((im, i) => (
          <div key={im._id} draggable onDragStart={() => setDragIdx(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(i)}
            className={`group relative overflow-hidden rounded-xl border bg-white ${dragIdx === i ? "opacity-40" : ""} ${i === 0 ? "border-ink ring-1 ring-ink" : "border-gray-200"}`}>
            <div className="aspect-square cursor-grab bg-gray-100 active:cursor-grabbing"><img src={sized(im.url, 300)} alt={im.altText} className="h-full w-full object-cover" /></div>
            {i === 0 && <span className="chip absolute left-2 top-2 bg-ink text-white">Main</span>}
            <span className="absolute right-2 top-2 rounded-md bg-white/90 p-1 text-ink-muted opacity-0 group-hover:opacity-100"><HiArrowsUpDown className="h-3.5 w-3.5" /></span>
            <div className="flex items-center gap-1 p-2">
              <input aria-label="Alt text" className="min-w-0 flex-1 rounded-md border border-transparent px-1.5 py-1 text-xs hover:border-gray-200 focus:border-brand-500 focus:outline-none" placeholder="Alt text"
                value={im.altText} onChange={(e) => { setDirty(true); setImages(images.map((x) => (x._id === im._id ? { ...x, altText: e.target.value } : x))); }}
                onBlur={() => dirty && persist(images)} />
              <button type="button" aria-label="Remove image" className="rounded-md p-1 text-ink-muted hover:bg-red-50 hover:text-red-600" onClick={() => persist(images.filter((x) => x._id !== im._id))}><HiOutlineTrash className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        {uploads.map((u) => (
          <div key={u.id} className="flex aspect-square flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 p-3 text-center">
            <Spinner className="h-6 w-6 text-brand-600" />
            <div className="mt-2 w-full truncate text-xs">{u.name}</div>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-100"><div className="h-full bg-brand-600 transition-all" style={{ width: `${u.progress * 100}%` }} /></div>
          </div>
        ))}
        <button type="button" onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) upload([...e.dataTransfer.files]); }}
          className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 text-ink-muted transition hover:border-brand-500 hover:text-brand-600">
          <HiOutlinePhoto className="h-8 w-8" />
          <span className="mt-2 text-xs font-medium">Upload or drop images</span>
          <span className="text-[11px]">JPG, PNG, WebP · 5 MB max</span>
        </button>
      </div>
      <input ref={input} type="file" accept={TYPES.join(",")} multiple hidden onChange={(e) => { upload([...e.target.files]); e.target.value = ""; }} />
      <p className="mt-2 text-xs text-ink-muted">{saving ? "Saving…" : "Drag to reorder — the first image is the main one. Metadata (EXIF/GPS) is stripped on upload."}</p>
    </div>
  );
}
