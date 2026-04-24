import React, { useState } from "react";
import { Link } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Brain, ArrowRight, EnvelopeSimple, Info } from "@phosphor-icons/react";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api.post("/auth/forgot-password", { email });
      setDone(true);
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
        <h1 className="font-heading text-3xl font-black">Forgot password?</h1>
        <p className="mt-1 text-ink/70">We'll generate a reset link for your account.</p>

        {done ? (
          <div className="mt-6 border-2 border-ink rounded-md bg-mint p-4" data-testid="forgot-sent">
            <p className="font-heading font-bold flex items-center gap-2">
              <EnvelopeSimple size={18} weight="bold" /> Reset link generated
            </p>
            <p className="mt-2 text-sm">
              If the email exists, a reset link was generated. For this demo build we <b>log the link to the backend console</b> instead of sending a real email.
            </p>
            <p className="mt-2 text-sm">Ask the server admin to copy the latest link from the logs and open it to reset.</p>
            <Link to="/login" className="brut-btn-primary mt-4 text-sm">
              Back to sign in <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="forgot-form">
            <div>
              <label className="font-heading font-bold text-sm">Email</label>
              <input type="email" required className="brut-input mt-1" value={email}
                onChange={(e) => setEmail(e.target.value)} data-testid="forgot-email" />
            </div>
            {err && <p className="text-sm text-coral font-bold">{err}</p>}
            <button type="submit" disabled={busy} className="brut-btn-primary w-full" data-testid="forgot-submit">
              {busy ? "Generating…" : "Send reset link"} <ArrowRight size={14} weight="bold" />
            </button>
            <div className="rounded-md border-2 border-ink bg-sun/70 p-3 text-xs flex gap-2 items-start">
              <Info size={14} weight="bold" className="mt-0.5 shrink-0" />
              <span>Demo mode: reset links are printed to the backend console, not emailed.</span>
            </div>
            <p className="text-sm text-center">
              <Link to="/login" className="underline font-bold">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
