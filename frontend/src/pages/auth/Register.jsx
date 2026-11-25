import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { registerUser, clearAuthError } from "../../redux/auth/authSlice";
import { Button, Field, Input, Alert } from "@store/shared";
import AuthShell, { PasswordInput, pillInput, pillButton } from "./AuthShell";
import { useDocumentTitle } from "@store/shared";

export default function Register() {
  useDocumentTitle("Create account");
  const dispatch = useDispatch();
  const { loading, error } = useSelector((s) => s.auth);
  const [params] = useSearchParams();
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ defaultValues: { email: params.get("email") || "" } });
  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);
  return (
    <AuthShell title="Create your account" subtitle="Track orders, save addresses and check out faster."
      footer={<>Already have an account? <Link to={`/auth/login${params.get("next") ? `?next=${encodeURIComponent(params.get("next"))}` : ""}`} className="link">Sign in</Link></>}>
      <form onSubmit={handleSubmit((d) => dispatch(registerUser(d)))} className="space-y-5" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Full name" required error={errors.name?.message}>
          <Input autoComplete="name" autoFocus placeholder="Full name" className={pillInput} {...register("name", { required: "Name is required", minLength: { value: 2, message: "Name is too short" } })} error={errors.name} />
        </Field>
        <Field label="E-mail Address" required error={errors.email?.message}>
          <Input type="email" autoComplete="email" placeholder="E-mail Address" className={pillInput} {...register("email", { required: "Email is required", pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: "Enter a valid email" } })} error={errors.email} />
        </Field>
        <Field label="Password" required error={errors.password?.message} hint="At least 6 characters">
          <PasswordInput autoComplete="new-password" placeholder="Password" {...register("password", { required: "Password is required", minLength: { value: 6, message: "At least 6 characters" } })} error={errors.password} />
        </Field>
        <Field label="Confirm password" required error={errors.confirmPassword?.message}>
          <PasswordInput autoComplete="new-password" placeholder="Confirm password" {...register("confirmPassword", { validate: (v) => v === watch("password") || "Passwords do not match" })} error={errors.confirmPassword} />
        </Field>
        <Button type="submit" className={`${pillButton} !mt-7`} loading={loading}>Create account</Button>
      </form>
    </AuthShell>
  );
}
