import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { HiOutlineEye, HiOutlineEyeSlash, HiOutlineArrowLeft } from "react-icons/hi2";
import { Alert, Spinner, useDocumentTitle } from "@store/shared";
import { loginUser, verifyTwoFactor } from "../redux/authSlice";

const inputCls = "h-12 w-full rounded-full border border-gray-200 bg-white px-5 text-sm text-ink outline-none transition placeholder:text-gray-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100";
const buttonCls = "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-indigo-500 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60";

function Label({ htmlFor, children, aside }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <label htmlFor={htmlFor} className="text-xs font-medium text-ink">{children} <span className="text-red-500">*</span></label>
      {aside}
    </div>
  );
}

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

export default function Login() {
  useDocumentTitle("Admin sign in");
  const dispatch = useDispatch();
  const { loading, error, challenge } = useSelector((s) => s.auth);
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [code, setCode] = useState("");

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-b from-[#170a5c] via-[#2e2a9e] to-[#5b5fe8] px-4 py-10">
      <Backdrop />
      <div className="relative w-full max-w-[420px] animate-pop-in rounded-[2rem] bg-white px-7 py-9 shadow-2xl shadow-indigo-950/30 sm:px-9">
        <div className="flex flex-col items-center">
          <span className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-indigo-500">
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true"><path fill="currentColor" d="M4 4h9l-3 3H7v3L4 13zm16 16h-9l3-3h3v-3l3-3zM9 9h6v6H9z" /></svg>
            Prabin
          </span>
          <span className="mt-1 text-xs text-ink-muted">Dashboard Portal</span>
        </div>

        {challenge ? (
          <form onSubmit={(e) => { e.preventDefault(); dispatch(verifyTwoFactor({ challenge, code })); }} className="mt-8 space-y-5">
            <div>
              <h1 className="text-lg font-semibold text-ink">Two-step verification</h1>
              <p className="mt-1 text-xs text-ink-muted">Enter the 6-digit code from your authenticator app.</p>
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            <div>
              <Label htmlFor="code">Authentication code</Label>
              <input id="code" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${inputCls} text-center font-mono text-xl tracking-[0.5em]`} />
            </div>
            <button type="submit" className={buttonCls} disabled={loading || code.length !== 6}>{loading && <Spinner className="h-4 w-4" />} Verify</button>
            <button type="button" onClick={() => window.location.reload()} className="mx-auto flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"><HiOutlineArrowLeft className="h-3.5 w-3.5" /> Back to log in</button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); dispatch(loginUser(form)); }} className="mt-8 space-y-5">
            <h1 className="text-lg font-semibold text-ink">Log In</h1>
            {error && <Alert tone="error">{error}</Alert>}
            <div>
              <Label htmlFor="email">E-mail Address</Label>
              <input id="email" type="email" autoComplete="username" autoFocus required placeholder="E-mail Address"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </div>
            <div>
              <Label htmlFor="password" aside={<button type="button" onClick={() => setForgot((f) => !f)} className="text-xs text-indigo-500 hover:underline">Forgot Password?</button>}>Password</Label>
              <div className="relative">
                <input id="password" type={showPw ? "text" : "password"} autoComplete="current-password" required placeholder="Password"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={`${inputCls} pr-12`} />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <HiOutlineEye className="h-5 w-5" /> : <HiOutlineEyeSlash className="h-5 w-5" />}
                </button>
              </div>
              {forgot && <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">Staff passwords are reset by an admin. Ask an admin to reset yours from Staff &amp; roles.</p>}
            </div>
            <button type="submit" className={`${buttonCls} !mt-7`} disabled={loading}>{loading && <Spinner className="h-4 w-4" />} Log In</button>
          </form>
        )}
      </div>
    </div>
  );
}
