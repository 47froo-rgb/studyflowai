import React, { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Brain, ArrowRight, CheckCircle } from "@phosphor-icons/react";

const ResetPasswordPage = () => {
  const { token } = useParams();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return setErr("Passwords do not match");
    if (password.length < 6) return setErr("Password must be at least 6 characters");
    setBusy(true); setErr("");
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => nav("/login"), 2000);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md brut-card p-8">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <span className="flex h-9 w-9 items-center justify-center bg-lavender border-2 border-ink rounded-md shadow-brut-sm">
            <Brain size={20} weight="duotone" />
          </span>
          <span className="font-heading text-xl font-black">StudyFlow AI</span>
        </Link>
        {done ? (
          <div data-testid="reset-done">
            <div className="flex items-center gap-2 font-heading text-2xl font-black">
              <CheckCircle size={28} weight="fill" className="text-mint-foreground" /> Password reset
            </div>
            <p className="mt-2 text-ink/70">Redirecting you to sign in…</p>
          </div>
        ) : (
          <>
            <h1 className="font-heading text-3xl font-black">Set a new password</h1>
            <p className="mt-1 text-ink/70">Enter a new password for your account.</p>
            <form onSubmit={submit} className="mt-6 space-y-4" data-testid="reset-form">
              <div>
                <label className="font-heading font-bold text-sm">New password</label>
                <input type="password" required minLength={6} className="brut-input mt-1"
                  value={password} onChange={(e) => setPassword(e.target.value)} data-testid="reset-password" />
              </div>
              <div>
                <label className="font-heading font-bold text-sm">Confirm password</label>
                <input type="password" required minLength={6} className="brut-input mt-1"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} data-testid="reset-confirm" />
              </div>
              {err && <p className="text-sm text-coral font-bold">{err}</p>}
              <button type="submit" disabled={busy} className="brut-btn-primary w-full" data-testid="reset-submit">
                {busy ? "Resetting…" : "Reset password"} <ArrowRight size={14} weight="bold" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
