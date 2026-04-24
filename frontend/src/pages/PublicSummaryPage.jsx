import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Brain, ArrowRight, Sparkle, WarningOctagon } from "@phosphor-icons/react";
import Loader from "@/components/Loader";

const PublicSummaryPage = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/public/summaries/${token}`);
        setData(data);
      } catch (e) {
        setErr(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      }
    })();
  }, [token]);

  if (err) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-6">
        <div className="brut-card p-8 max-w-md text-center" data-testid="public-error">
          <WarningOctagon size={40} weight="fill" className="mx-auto text-coral" />
          <h1 className="mt-3 font-heading text-3xl font-black">Link unavailable</h1>
          <p className="mt-2 text-ink/70">{err}</p>
          <Link to="/" className="brut-btn-primary mt-6 inline-flex">Visit StudyFlow AI <ArrowRight size={14} weight="bold" /></Link>
        </div>
      </div>
    );
  }

  if (!data) return <Loader />;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b-2 border-ink">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center bg-lavender border-2 border-ink rounded-md shadow-brut-sm">
              <Brain size={20} weight="duotone" />
            </span>
            <span className="font-heading text-xl font-black">StudyFlow AI</span>
          </Link>
          <Link to="/register" className="brut-btn-primary text-sm" data-testid="public-cta">
            Create your own <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12" data-testid="public-summary">
        <span className="brut-badge bg-sun"><Sparkle size={12} weight="fill" /> Shared study summary</span>
        <h1 className="mt-4 font-heading text-4xl sm:text-5xl font-black tracking-tight leading-[1.05]">
          {data.title}
        </h1>
        <p className="mt-2 text-ink/70">
          Shared by <span className="font-bold">{data.author_name}</span>
          {data.created_at && <> · {new Date(data.created_at).toLocaleDateString()}</>}
        </p>

        {data.key_concepts.length === 0 ? (
          <p className="mt-10 text-ink/60">AI is still processing this document. Check back soon.</p>
        ) : (
          <>
            <h2 className="mt-10 font-heading text-2xl font-bold">Key Concepts</h2>
            <ol className="mt-4 grid gap-3">
              {data.key_concepts.map((c, i) => (
                <li key={i} className="brut-card p-4 flex gap-3 items-start">
                  <span className="brut-badge bg-lavender">{String(i + 1).padStart(2, "0")}</span>
                  <p className="font-body text-[15px] leading-relaxed">{c}</p>
                </li>
              ))}
            </ol>
          </>
        )}

        <div className="mt-12 brut-card p-6 sm:p-8 bg-mint flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between" data-testid="public-upsell">
          <div>
            <p className="font-heading text-xl font-black">Study like this. For free.</p>
            <p className="text-sm text-ink/70 mt-1">
              Upload your own PDFs and get AI-generated key concepts + quizzes in seconds.
            </p>
          </div>
          <Link to="/register" className="brut-btn-primary">
            Try StudyFlow AI <ArrowRight size={14} weight="bold" />
          </Link>
        </div>
      </main>
    </div>
  );
};

export default PublicSummaryPage;
