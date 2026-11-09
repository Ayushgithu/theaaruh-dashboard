"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { forgotSchema, loginSchema } from "@/lib/validation";
import { postJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { LogoMark } from "@/components/ui/icons";
import { brandName } from "@/lib/brand";

export type AuthMode = "login" | "forgot" | "sent" | "reset";

const resetFormSchema = z
  .object({ password: z.string().min(8, "Use at least 8 characters"), confirm: z.string().min(1, "Confirm your new password") })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

const TITLES: Record<AuthMode, string> = {
  login: "Admin sign in",
  forgot: "Forgot password",
  sent: "Check your email",
  reset: "Choose a new password",
};

export function AdminLoginScreen() {
  const [mode, setMode] = React.useState<AuthMode>("login");
  const [email, setEmail] = React.useState("");
  const [reset, setReset] = React.useState<{ token: string; email: string } | null>(null);

  // /login?mode=reset&token=…&email=… comes from the reset email. Remove the secret from the address bar right away.
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("mode") === "reset" && q.get("token") && q.get("email")) {
      // Parse browser-only reset parameters after hydration to avoid exposing them in server-rendered state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReset({ token: q.get("token")!, email: q.get("email")! });
      setMode("reset");
    } else if (q.get("mode") === "forgot") setMode("forgot");
    if (q.has("mode") || q.has("token") || q.has("email")) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <LogoMark className="h-12 w-14 shrink-0" />
          <span className="text-xl font-extrabold text-ink">{brandName}</span>
        </div>
        <div className="rounded-sm border border-line bg-card p-6 sm:p-8">
          <h1 className="text-xl font-bold text-ink">{TITLES[mode]}</h1>
          <p className="mb-5 mt-1 text-sm">
            {mode === "login" && "Sign in to manage your store."}
            {mode === "forgot" && "Enter your admin email and we will send you a reset link."}
            {mode === "sent" && "If that email belongs to an admin, a reset link is on its way."}
            {mode === "reset" && `Setting a new password for ${reset?.email}.`}
          </p>

          {mode === "login" && <LoginPanel onForgot={(e) => { setEmail(e); setMode("forgot"); }} onDone={() => {}} />}
          {mode === "forgot" && <ForgotPanel initialEmail={email} onBack={() => setMode("login")} onSent={(e) => { setEmail(e); setMode("sent"); }} />}
          {mode === "sent" && <SentPanel email={email} onBack={() => setMode("login")} onResend={() => setMode("forgot")} />}
          {mode === "reset" && reset && (
            <ResetPanel token={reset.token} email={reset.email} onDone={() => { toast.success("Password updated", { description: "Sign in with your new password." }); setMode("login"); }} />
          )}
        </div>
        <p className="mt-6 text-center text-xs text-ink/50">
          Created by{" "}
          <a href="https://lexicalsoftware.in" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
            Lexical Software
          </a>
        </p>
      </div>
    </main>
  );
}

/* ---------------------------------- Login ---------------------------------- */
type LoginValues = z.infer<typeof loginSchema>;

function LoginPanel({ onForgot, onDone }: { onForgot: (email: string) => void; onDone: () => void }) {
  const router = useRouter();
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState("");
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (v: LoginValues) => {
    setError("");
    try {
      await postJson("/api/admin/login", v);
      toast.success("Welcome back");
      onDone();
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {error && <p role="alert" className="rounded-sm bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      <Field label="Email" error={errors.email?.message}>
        <Input type="email" autoComplete="username" autoFocus aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="admin-password" error={errors.password?.message}>
        <div className="relative">
          <Input id="admin-password" type={show ? "text" : "password"} autoComplete="current-password" className="pr-12" aria-invalid={!!errors.password} {...register("password")} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-slate-500 hover:text-ink">
            {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </Field>
      <div className="flex justify-end">
        <button type="button" onClick={() => onForgot(getValues("email") ?? "")} className="min-h-9 text-sm font-semibold text-primary hover:underline">
          Forgot password?
        </button>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : "Sign in"}
      </Button>
    </form>
  );
}

/* ----------------------------- Forgot password ----------------------------- */
function ForgotPanel({ initialEmail, onBack, onSent }: { initialEmail: string; onBack: () => void; onSent: (email: string) => void }) {
  const [error, setError] = React.useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: initialEmail },
  });

  const onSubmit = async (v: z.infer<typeof forgotSchema>) => {
    setError("");
    try {
      await postJson("/api/admin/forgot-password", v);
      onSent(v.email);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the email. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {error && <p role="alert" className="rounded-sm bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      <Field label="Admin email" error={errors.email?.message}>
        <Input type="email" autoComplete="email" autoFocus aria-invalid={!!errors.email} {...register("email")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Send reset link"}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back to sign in</Button>
    </form>
  );
}

function SentPanel({ email, onBack, onResend }: { email: string; onBack: () => void; onResend: () => void }) {
  return (
    <div className="text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-sm bg-emerald-50 text-emerald-700"><MailCheck className="h-7 w-7" /></span>
      <p className="mt-4 text-sm">
        We sent a reset link to <strong className="font-semibold text-ink">{email}</strong>. It is valid for 1 hour. Check your spam folder if you do not see it.
      </p>
      <div className="mt-6 grid gap-2">
        <Button type="button" variant="outline" onClick={onResend}>Use a different email / send again</Button>
        <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back to sign in</Button>
      </div>
    </div>
  );
}

/* ------------------------------ Reset password ------------------------------ */
function ResetPanel({ token, email, onDone }: { token: string; email: string; onDone: () => void }) {
  const [error, setError] = React.useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetFormSchema>>({ resolver: zodResolver(resetFormSchema) });

  const onSubmit = async (v: z.infer<typeof resetFormSchema>) => {
    setError("");
    try {
      await postJson("/api/admin/reset-password", { email, token, password: v.password });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the password.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {error && (
        <p role="alert" className="rounded-sm bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
      )}
      <Field label="New password" hint="At least 8 characters" error={errors.password?.message}>
        <Input type="password" autoComplete="new-password" autoFocus aria-invalid={!!errors.password} {...register("password")} />
      </Field>
      <Field label="Confirm new password" error={errors.confirm?.message}>
        <Input type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register("confirm")} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Update password"}
      </Button>
    </form>
  );
}
