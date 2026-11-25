import { HiOutlineTruck } from "react-icons/hi2";
import { money } from "@store/shared";

export default function FreeShippingBar({ freeShipping }) {
  if (!freeShipping) return null;
  const { threshold, remaining, qualified } = freeShipping;
  const pct = Math.min(100, ((threshold - remaining) / threshold) * 100);
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <HiOutlineTruck className={`h-5 w-5 ${qualified ? "text-emerald-600" : "text-ink-muted"}`} />
        {qualified ? (
          <span className="font-medium text-emerald-700">You’ve unlocked free standard delivery</span>
        ) : (
          <span>Add <b>{money(remaining)}</b> more for free delivery</span>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full rounded-full transition-all duration-500 ${qualified ? "bg-emerald-500" : "bg-brand-600"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
