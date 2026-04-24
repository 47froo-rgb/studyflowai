import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Brain, CheckCircle, XCircle, ArrowRight } from "@phosphor-icons/react";

const VerifyEmailPage = () => {
  const { token } = useParams();
  const { refresh } = useAuth();
  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        await api.post("/auth/verify-email", { token });
        setStatus("success");
        refresh?.();
      } catch (e) {
        setStatus("error");
        setMsg(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      }
    })();
  }, [token, refresh]);

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md brut-card p-8 text-center" data-testid={`verify-${status}`}>
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <span className="flex h-9 w-9 items-center justify-center bg-lavender border-2 border-ink rounded-md shadow-brut-sm">
            <Brain size={20} weight="duotone" />
          </span>
          <span className="font-heading text-xl font-black">StudyFlow AI</span>
        </Link>
        {status === "verifying" && <p className="font-heading font-bold">Verifying…</p>}
        {status === "success" && (
          <div>
            <CheckCircle size={48} weight="fill" className="mx-auto text-[#10B981]" />
            <h1 className="mt-3 font-heading text-3xl font-black">Email verified</h1>
            <p className="mt-2 text-ink/70">You're all set. Your account is now fully activated.</p>
            <Link to="/dashboard" className="brut-btn-primary mt-6 inline-flex">
              Go to Library <ArrowRight size={14} weight="bold" />
            </Link>
          </div>
        )}
        {status === "error" && (
          <div>
            <XCircle size={48} weight="fill" className="mx-auto text-coral" />
            <h1 className="mt-3 font-heading text-3xl font-black">Verification failed</h1>
            <p className="mt-2 text-ink/70">{msg || "The link is invalid or has expired."}</p>
            <Link to="/dashboard" className="brut-btn-secondary mt-6 inline-flex">
              Request a new link from your dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
