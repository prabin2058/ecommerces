/* eslint-disable react/prop-types */
import { cloneElement, forwardRef, isValidElement, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { HiMinus, HiPlus, HiXMark, HiChevronLeft, HiChevronRight } from "react-icons/hi2";
import { money, STATUS_LABEL, discountPct, srcSetFor } from "./format";

export function Spinner({ className = "h-5 w-5" }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".2" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-ink-muted">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function Button({ variant = "primary", size, loading, children, className = "", ...props }) {
  const cls = { primary: "btn-primary", brand: "btn-brand", outline: "btn-outline", ghost: "btn-ghost", danger: "btn-danger" }[variant];
  return (
    <button className={`${cls} ${size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : ""} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, className = "", required }) {
  const autoId = useId();
  // Link the label (and error/hint text) to a single child control for screen readers.
  const single = isValidElement(children) ? children : null;
  const id = single?.props.id || autoId;
  const descId = `${id}-desc`;
  const control = single ? cloneElement(single, { id, "aria-describedby": error || hint ? descId : undefined, "aria-required": required || undefined }) : children;
  return (
    <div className={className}>
      {label && (
        <label className="label" htmlFor={single ? id : undefined}>
          {label}
          {required && <span className="text-red-500" aria-hidden="true"> *</span>}
        </label>
      )}
      {control}
      {error ? <p id={descId} className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : hint ? <p id={descId} className="mt-1.5 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

// forwardRef so react-hook-form's register() can attach to the real <input>.
export const Input = forwardRef(function Input({ error, className = "", ...props }, ref) {
  return <input ref={ref} className={`input ${error ? "input-error" : ""} ${className}`} aria-invalid={!!error} {...props} />;
});

export const Select = forwardRef(function Select({ error, className = "", children, ...props }, ref) {
  return (
    <select ref={ref} className={`input pr-8 ${error ? "input-error" : ""} ${className}`} {...props}>
      {children}
    </select>
  );
});

export function Checkbox({ label, className = "", ...props }) {
  return (
    <label className={`flex cursor-pointer select-none items-start gap-2.5 text-sm ${className}`}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" {...props} />
      <span>{label}</span>
    </label>
  );
}

const TONES = {
  gray: "bg-gray-100 text-gray-700", green: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  yellow: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-600/20", red: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  blue: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-600/20", purple: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-600/20",
  brand: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20", dark: "bg-ink text-white",
};
export function Badge({ tone = "gray", children, className = "" }) {
  return <span className={`chip ${TONES[tone]} ${className}`}>{children}</span>;
}

const STATUS_TONE = {
  pending_payment: "yellow", paid: "green", confirmed: "blue", processing: "purple", shipped: "brand", delivered: "green",
  cancelled: "gray", refunded: "red", returned: "red", draft: "gray", active: "green", archived: "yellow", scheduled: "blue",
  unpaid: "yellow", refund_pending: "red", partially_refunded: "yellow",
};
export function StatusBadge({ status }) {
  return <Badge tone={STATUS_TONE[status] || "gray"}>{STATUS_LABEL[status] || status}</Badge>;
}

export function Price({ price, compareAt, className = "", size = "base" }) {
  const off = discountPct(price, compareAt);
  const sz = { sm: "text-sm", base: "text-base", lg: "text-2xl" }[size];
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className={`font-semibold text-ink ${sz}`}>{money(price)}</span>
      {off > 0 && (
        <>
          <span className="text-sm text-ink-muted line-through">{money(compareAt)}</span>
          <span className="text-xs font-semibold text-emerald-600">{off}% off</span>
        </>
      )}
    </span>
  );
}

export function QuantityStepper({ value, onChange, min = 1, max = 10, disabled, size = "md" }) {
  const h = size === "sm" ? "h-8" : "h-11";
  return (
    <div className={`inline-flex ${h} items-center rounded-xl border border-gray-300 bg-white`}>
      <button type="button" aria-label="Decrease quantity" className="flex h-full w-9 items-center justify-center text-ink-soft hover:text-ink disabled:opacity-30" disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        <HiMinus />
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" aria-label="Increase quantity" className="flex h-full w-9 items-center justify-center text-ink-soft hover:text-ink disabled:opacity-30" disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        <HiPlus />
      </button>
    </div>
  );
}

function useLockScroll(open) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, children, footer, size = "md" }) {
  useLockScroll(open);
  useEscape(open, onClose);
  const ref = useRef(null);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  const w = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-gray-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className={`relative w-full ${w} max-h-[92vh] animate-pop-in overflow-y-auto rounded-t-2xl bg-white shadow-pop outline-none sm:rounded-2xl`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="rounded-lg p-1.5 text-ink-muted hover:bg-gray-100 hover:text-ink" onClick={onClose} aria-label="Close">
            <HiXMark className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-100 bg-white px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Drawer({ open, onClose, title, children, footer }) {
  useLockScroll(open);
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-gray-900/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md animate-slide-in flex-col bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="rounded-lg p-1.5 text-ink-muted hover:bg-gray-100 hover:text-ink" onClick={onClose} aria-label="Close">
            <HiXMark className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-gray-100 p-5">{footer}</div>}
      </aside>
    </div>,
    document.body
  );
}

export function Confirm({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", danger, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>{confirmLabel}</Button></>}>
      <p className="text-sm text-ink-soft">{message}</p>
    </Modal>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-ink-muted">
          <Icon className="h-7 w-7" />
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "info", title, children, className = "", action }) {
  const t = {
    info: "bg-sky-50 text-sky-900 border-sky-200", warning: "bg-amber-50 text-amber-900 border-amber-200",
    error: "bg-red-50 text-red-900 border-red-200", success: "bg-emerald-50 text-emerald-900 border-emerald-200",
  }[tone];
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${t} ${className}`} role={tone === "error" ? "alert" : "status"}>
      <div className="flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

export function Pagination({ page, pages, onChange }) {
  if (!pages || pages <= 1) return null;
  const nums = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i);
  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page"><HiChevronLeft /></button>
      {nums.map((n) => (
        <button key={n} onClick={() => onChange(n)} aria-current={n === page ? "page" : undefined}
          className={`h-8 min-w-8 rounded-lg px-2 text-sm font-medium ${n === page ? "bg-ink text-white" : "text-ink-soft hover:bg-gray-100"}`}>{n}</button>
      ))}
      <button className="btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page"><HiChevronRight /></button>
    </nav>
  );
}

export function ProductImage({ src, alt, className = "", sizes = "(min-width: 768px) 25vw, 50vw", eager }) {
  return src ? (
    <img src={src} srcSet={srcSetFor(src)} sizes={sizes} alt={alt || ""} loading={eager ? "eager" : "lazy"} decoding="async" className={`h-full w-full object-cover ${className}`} />
  ) : (
    <div className={`flex h-full w-full items-center justify-center bg-gray-100 text-xs text-ink-muted ${className}`}>No image</div>
  );
}
