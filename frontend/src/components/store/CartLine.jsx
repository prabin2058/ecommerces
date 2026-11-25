import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { HiOutlineTrash, HiOutlineBookmark, HiExclamationTriangle } from "react-icons/hi2";
import { QuantityStepper, ProductImage, Button } from "@store/shared";
import { money } from "@store/shared";
import { updateQty, removeLine, acceptPrice, saveForLater } from "../../redux/cart/cartSlice";

export default function CartLine({ item, compact = false, maxQty = 10 }) {
  const dispatch = useDispatch();
  const run = async (action) => {
    const r = await dispatch(action);
    if (r.error) toast.error(r.payload?.message || "Could not update cart");
  };
  const priceIssue = item.issues.find((i) => i.code === "PRICE_CHANGED");
  const otherIssues = item.issues.filter((i) => i.code !== "PRICE_CHANGED");
  const max = Math.min(maxQty, item.available ?? maxQty);
  return (
    <div className={`flex gap-4 ${compact ? "py-4" : "py-6"}`}>
      <Link to={item.slug ? `/products/${item.slug}` : "#"} className={`${compact ? "h-20 w-16" : "h-28 w-24"} shrink-0 overflow-hidden rounded-xl bg-gray-100`}>
        <ProductImage src={item.image} alt={item.name} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={item.slug ? `/products/${item.slug}` : "#"} className="line-clamp-2 text-sm font-medium hover:underline">{item.name}</Link>
            {item.options && item.options !== "Default" && <div className="mt-0.5 text-xs text-ink-muted">{item.options}</div>}
            {!compact && <div className="mt-0.5 text-xs text-ink-muted">{money(item.unitPrice)} each · SKU {item.sku}</div>}
          </div>
          <div className="text-right text-sm font-semibold tabular-nums">{money(item.lineTotal)}</div>
        </div>

        {priceIssue && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <HiExclamationTriangle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{priceIssue.message}</span>
            <Button size="sm" variant="outline" onClick={() => run(acceptPrice(item.id))}>Accept new price</Button>
          </div>
        )}
        {otherIssues.map((i) => (
          <div key={i.code} className="mt-2 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            <HiExclamationTriangle className="h-4 w-4 shrink-0" /> {i.message}
          </div>
        ))}
        {item.backorder && <div className="mt-1 text-xs text-amber-700">Backordered — ships when restocked</div>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {otherIssues.some((i) => i.code === "UNAVAILABLE" || i.code === "OUT_OF_STOCK") ? null : (
            <QuantityStepper size="sm" value={item.quantity} max={Math.max(max, item.quantity > max ? item.quantity : 1)} onChange={(q) => run(updateQty({ id: item.id, quantity: q }))} />
          )}
          {otherIssues.some((i) => i.code === "INSUFFICIENT_STOCK") && item.available > 0 && (
            <Button size="sm" variant="outline" onClick={() => run(updateQty({ id: item.id, quantity: item.available }))}>Set to {item.available}</Button>
          )}
          {!compact && (
            <button className="btn-ghost btn-sm" onClick={() => run(saveForLater(item.id))}>
              <HiOutlineBookmark /> Save for later
            </button>
          )}
          <button className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => run(removeLine(item.id))} aria-label={`Remove ${item.name}`}>
            <HiOutlineTrash /> {!compact && "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
