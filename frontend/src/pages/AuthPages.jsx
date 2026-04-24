import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Brain, ArrowRight } from "@phosphor-icons/react";
import { toast } from "sonner";

const AUTH_IMG = "https://images.pexels.com/photos/6549349/pexels-photo-6549349.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="min-h-screen bg-paper grid grid-cols-1 lg:grid-cols-2">
    <div className="hidden lg:block relative border-r-2 border-ink overflow-hidden">
      <img src={AUTH_IMG} alt="Study" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-lavender/40 mix-blend-multiply" />
      <div className="absolute inset-0 p-10 flex flex-col justify-between">
        <Link to="/" className="inline-flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center bg-paper border-2 border-ink rounded-md shadow-brut-sm">
            <Brain size={20} weight="duotone" />
          </span>
          <span className="font-heading text-xl font-black text-paper drop-shadow">StudyFlow AI</span>
        </Link>
        <div className="bg-paper border-2 border-ink rounded-md p-6 shadow-brut max-w-md">
          <p className="font-heading font-black text-2xl leading-tight">
            Turn dense notes into <span className="bg-sun px-1">crystal-clear concepts</span> and quizzes in seconds.
          </p>
          <p className="mt-3 text-sm text-ink/70">Upload a PDF, let Gemini AI do the heavy lifting, track your progress weekly.</p>
        </div>
      </div>
    </div>
    <div className="flex items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-md">
        <div className="lg:hidden flex items-center gap-2 mb-6">
          <span className="flex h-9 w-9 items-center justify-center bg-lavender border-2 border-ink rounded-md shadow-brut-sm">
            <Brain size={20} weight="duotone" />
          </span>
          <span className="font-heading text-xl font-black">StudyFlow AI</span>
        </div>
        <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 text-ink/70">{subtitle}</p>
        <div className="mt-8">{children}</div>
        <div className="mt-6 text-sm text-ink/70">{footer}</div>
      </div>
    </div>
  </div>
);

export const LoginPage = () => {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const r = await login(email, password);
    setBusy(false);
    if (r.ok) {
      toast.success(`Welcome back, ${r.user.name}`);
      nav(loc.state?.from?.pathname || "/dashboard");
    } else {
      setErr(r.error);
    }
  };

  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Sign in to your Study Library."
      footer={<>New here? <Link to="/register" className="font-bold underline" data-testid="link-register">Create an account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <div>
          <label className="font-heading font-bold text-sm">Email</label>
          <input type="email" required className="brut-input mt-1" value={email}
            onChange={(e) => setEmail(e.target.value)} data-testid="login-email" />
        </div>
        <div>
          <label className="font-heading font-bold text-sm">Password</label>
          <input type="password" required className="brut-input mt-1" value={password}
            onChange={(e) => setPassword(e.target.value)} data-testid="login-password" />
        </div>
        {err && <p className="text-sm text-coral font-bold" data-testid="login-error">{err}</p>}
        <button type="submit" disabled={busy} className="brut-btn-primary w-full" data-testid="login-submit">
          {busy ? "Signing in…" : "Sign in"} <ArrowRight size={16} weight="bold" />
        </button>
        <p className="text-sm text-center">
          <Link to="/forgot-password" className="underline font-bold" data-testid="link-forgot">Forgot password?</Link>
        </p>
        <div className="rounded-md border-2 border-ink bg-mint/50 p-3 text-xs">
          <span className="font-bold">Demo admin:</span> admin@studyflow.ai / Admin@123
        </div>
      </form>
    </AuthLayout>
  );
};

export const RegisterPage = () => {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const r = await register(form.name, form.email, form.password);
    setBusy(false);
    if (r.ok) {
      toast.success(`Welcome to StudyFlow, ${r.user.name}`);
      nav("/dashboard");
    } else setErr(r.error);
  };

  return (
    <AuthLayout
      title="Create your account."
      subtitle="Join StudyFlow AI and supercharge your study sessions."
      footer={<>Have an account? <Link to="/login" className="font-bold underline" data-testid="link-login">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" data-testid="register-form">
        <div>
          <label className="font-heading font-bold text-sm">Full name</label>
          <input type="text" required className="brut-input mt-1" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="register-name" />
        </div>
        <div>
          <label className="font-heading font-bold text-sm">Email</label>
          <input type="email" required className="brut-input mt-1" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="register-email" />
        </div>
        <div>
          <label className="font-heading font-bold text-sm">Password</label>
          <input type="password" required minLength={6} className="brut-input mt-1" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="register-password" />
          <p className="text-xs text-ink/60 mt-1">Minimum 6 characters.</p>
        </div>
        {err && <p className="text-sm text-coral font-bold" data-testid="register-error">{err}</p>}
        <button type="submit" disabled={busy} className="brut-btn-primary w-full" data-testid="register-submit">
          {busy ? "Creating…" : "Create account"} <ArrowRight size={16} weight="bold" />
        </button>
      </form>
    </AuthLayout>
  );
};
