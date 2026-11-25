import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { Alert, Button, Field, Input, authApi, errorMessage, useDocumentTitle } from "@store/shared";
import { refreshMe, setUser } from "../redux/authSlice";
import { PageHeader } from "../layouts/AdminLayout";

export default function Security() {
  useDocumentTitle("Security");
  const { user } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const start = async () => {
    setBusy(true);
    try {
      setSetup(await authApi.setup2fa());
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const u = await authApi.confirm2fa(code);
      if (u.token) localStorage.setItem("authToken", u.token);
      dispatch(setUser(u));
      dispatch(refreshMe());
      setSetup(null);
      toast.success("Two-factor authentication is on");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader title="Security" description="Protect your staff account with a code from an authenticator app." />
      <div className="card max-w-xl p-6">
        <h2 className="text-lg font-semibold">Two-factor authentication</h2>
        <p className="mt-1 text-sm text-ink-muted">Works with Google Authenticator, 1Password, Authy and similar apps. Required for staff in production.</p>
        {user?.twoFactorEnabled ? (
          <Alert tone="success" className="mt-5" title="2FA is enabled">You’ll be asked for a code each time you sign in.</Alert>
        ) : setup ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-ink-soft">1. In your authenticator app, add an account using this setup key:</p>
            <div className="select-all break-all rounded-xl bg-gray-50 p-4 text-center font-mono text-lg tracking-widest">{setup.secret.match(/.{1,4}/g).join(" ")}</div>
            <a href={setup.otpauthUrl} className="link block text-center text-xs">Open in authenticator app (on this device)</a>
            <p className="text-sm text-ink-soft">2. Enter the 6-digit code it shows:</p>
            <Field error={error}>
              <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="text-center font-mono text-xl tracking-[0.4em]" error={error} />
            </Field>
            <Button className="w-full" loading={busy} disabled={code.length !== 6} onClick={confirm}>Turn on 2FA</Button>
          </div>
        ) : (
          <Button className="mt-5" loading={busy} onClick={start}>Set up 2FA</Button>
        )}
      </div>
    </>
  );
}
