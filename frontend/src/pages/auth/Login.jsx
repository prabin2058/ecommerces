import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { loginUser, verifyTwoFactor, clearAuthError } from "../../redux/auth/authSlice";
import { Button, Field, Input, Alert } from "@store/shared";
import AuthShell, { PasswordInput, pillInput, pillButton } from "./AuthShell";
import { useDocumentTitle } from "@store/shared";

export default function Login() {
  useDocumentTitle("Sign in");
  const dispatch = useDispatch();
  const { loading, error, challenge } = useSelector((s) => s.auth);
  const [params] = useSearchParams();
  const next = params.get("next");
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [code, setCode] = useState("");
  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  if (challenge)
    return (
      <AuthShell title="Two-factor authentication" subtitle="Enter the 6-digit code from your authenticator app.">
        <form onSubmit={(e) => { e.preventDefault(); dispatch(verifyTwoFactor({ challenge, code })); }} className="space-y-5">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Authentication code">
            <Input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${pillInput} text-center font-mono text-xl tracking-[0.5em]`} />
          </Field>
          <Button type="submit" className={pillButton} loading={loading} disabled={code.length !== 6}>Verify</Button>
        </form>
      </AuthShell>
    );

  return (
    <AuthShell title="Log In" subtitle={next === "/checkout" ? "Sign in to use saved addresses — your cart comes with you." : "Sign in to your account"}
      footer={<>New here? <Link to={`/auth/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="link">Create an account</Link></>}>
      <form onSubmit={handleSubmit((d) => dispatch(loginUser(d)))} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="E-mail Address" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" autoFocus placeholder="E-mail Address" className={pillInput} {...register("email", { required: "Email is required" })} error={errors.email} />
        </Field>
        <Field label="Password" required error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" placeholder="Password" {...register("password", { required: "Password is required" })} error={errors.password} />
        </Field>
        <Button type="submit" className={`${pillButton} !mt-7`} loading={loading}>Log In</Button>
      </form>
      {next === "/checkout" && <Link to="/checkout" className="mt-4 block text-center text-sm font-medium text-ink-soft hover:text-ink">Continue as guest →</Link>}
    </AuthShell>
  );
}
