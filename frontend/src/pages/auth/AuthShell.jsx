import { forwardRef, useState } from "react";
import { Link } from "react-router-dom";
import { HiOutlineShoppingBag, HiOutlineEye, HiOutlineEyeSlash } from "react-icons/hi2";
import { Input } from "@store/shared";

// Pill-shaped fields and button, matching the Figma auth screens.
export const pillInput = "!h-12 !rounded-full !px-5";
export const pillButton = "w-full !h-12 !rounded-full !bg-indigo-500 hover:!bg-indigo-600 !text-white";

// Password field with a show/hide eye. Field passes id/aria props through to the real <input>.
export const PasswordInput = forwardRef(function PasswordInput({ className = "", ...props }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={show ? "text" : "password"} className={`${pillInput} !pr-12 ${className}`} {...props} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {show ? <HiOutlineEye className="h-5 w-5" /> : <HiOutlineEyeSlash className="h-5 w-5" />}
      </button>
    </div>
  );
});

// Faint geometric tiles + dashed arcs from the design's background.
function Backdrop() {
  const tile = (x, y, r, s = 1) => (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} fill="#fff" fillOpacity=".07">
      <rect width="46" height="46" rx="4" transform="rotate(45)" /><rect x="40" y="-10" width="46" height="46" rx="4" transform="rotate(45)" /><rect x="-12" y="52" width="46" height="46" rx="4" transform="rotate(45)" />
    </g>
  );
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1512 804" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <path d="M210 0 C 330 260 330 560 180 804" fill="none" stroke="#fff" strokeOpacity=".35" strokeDasharray="3 6" />
      <path d="M1080 0 C 1200 120 1360 190 1512 210" fill="none" stroke="#fff" strokeOpacity=".35" strokeDasharray="3 6" />
      {tile(70, 10, 8)}{tile(1390, 20, -10)}{tile(80, 640, 0, 1.1)}{tile(1350, 620, 12, 1.1)}
    </svg>
  );
}

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-[calc(100svh-10rem)] items-center justify-center overflow-hidden bg-gradient-to-b from-[#170a5c] via-[#2e2a9e] to-[#5b5fe8] px-4 py-14">
      <Backdrop />
      <div className="relative w-full max-w-[440px] animate-pop-in rounded-[2rem] bg-white px-7 py-9 shadow-2xl shadow-indigo-950/30 sm:px-9">
        <Link to="/" className="flex items-center justify-center gap-2 text-2xl font-semibold tracking-tight text-indigo-500">
          <HiOutlineShoppingBag className="h-7 w-7" /> Prabin
        </Link>
        <h1 className="mt-7 text-lg font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
        {footer && <p className="mt-6 border-t border-gray-100 pt-5 text-center text-sm text-ink-muted">{footer}</p>}
      </div>
    </div>
  );
}
