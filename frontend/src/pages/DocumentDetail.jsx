import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api, formatApiErrorDetail } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import Loader from "@/components/Loader";
import {
  ArrowLeft, PencilSimple, FloppyDisk, Plus, Trash,
  ArrowsClockwise, CaretRight, ListChecks, Share, Link as LinkIcon,
  Copy, FilePdf, Download, Sparkle, X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

const DocumentDetail = () => {
  const { id } = useParams();
  const nav = useNavigate();
  const [doc, setDoc] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [concepts, setConcepts] = useState([]);
  const [sharing, setSharing] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenDiff, setRegenDiff] = useState("medium");
  const [regenCount, setRegenCount] = useState(8);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/documents/${id}`);
      setDoc(data);
      setTitle(data.title);
      setConcepts(data.summary?.key_concepts || []);
      setRegenDiff(data.difficulty || "medium");
      setRegenCount(data.question_count || 8);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
      nav("/dashboard");
    }
  }, [id, nav]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (doc?.status === "processing") {
      const t = setTimeout(load, 3500);
      return () => clearTimeout(t);
    }
  }, [doc?.status, load]);

  const saveTitle = async () => {
    if (!title.trim()) return;
    try {
      await api.patch(`/documents/${id}`, { title: title.trim() });
      setDoc({ ...doc, title: title.trim() });
      setEditingTitle(false);
      toast.success("Renamed");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const saveSummary = async () => {
    const clean = concepts.map((c) => c.trim()).filter(Boolean);
    if (clean.length === 0) return toast.error("Add at least one concept");
    try {
      const { data } = await api.patch(`/documents/${id}/summary`, { key_concepts: clean });
      setDoc({ ...doc, summary: data });
      setConcepts(data.key_concepts);
      setEditingSummary(false);
      toast.success("Summary updated");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const regenerate = async (opts) => {
    try {
      const body = opts ? { difficulty: opts.difficulty, question_count: opts.count } : undefined;
      await api.post(`/documents/${id}/regenerate`, body);
      toast.success("Regenerating with AI…");
      setDoc({ ...doc, status: "processing",
               difficulty: opts?.difficulty || doc.difficulty,
               question_count: opts?.count || doc.question_count });
      setRegenOpen(false);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const toggleShare = async (enabled) => {
    setSharing(true);
    try {
      const { data } = await api.post(`/documents/${id}/share`, { enabled });
      setDoc({
        ...doc,
        public_share_token: enabled ? data.token : null,
      });
      if (enabled) {
        const url = data.share_url;
        try { await navigator.clipboard.writeText(url); toast.success("Share link copied"); }
        catch { toast.success("Share link enabled"); }
      } else {
        toast.success("Share link revoked");
      }
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSharing(false); }
  };

  const copyShareUrl = async () => {
    if (!doc?.public_share_token) return;
    const url = `${window.location.origin}/shared/${doc.public_share_token}`;
    try { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
    catch { toast.error("Copy failed"); }
  };

  const downloadFile = async (kind) => {
    const ext = kind === "anki" ? "apkg" : "pdf";
    try {
      const resp = await api.get(`/documents/${id}/export/${kind}`, { responseType: "blob" });
      const blob = new Blob([resp.data], {
        type: kind === "anki" ? "application/octet-stream" : "application/pdf",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${(doc?.title || "studyflow").replace(/[^a-z0-9-_]+/gi, "_").slice(0, 60)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      toast.success(`${kind.toUpperCase()} downloaded`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    }
  };

  if (!doc) return <Loader />;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="doc-detail">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-bold mb-4 hover:underline" data-testid="back-to-library">
        <ArrowLeft size={14} weight="bold" /> Back to Library
      </Link>

      {/* Header */}
      <div className="brut-card p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {!editingTitle ? (
              <div className="flex items-start gap-2">
                <h1 className="font-heading text-3xl sm:text-4xl font-black leading-tight break-words" data-testid="doc-title">
                  {doc.title}
                </h1>
                <button onClick={() => setEditingTitle(true)} className="brut-btn-secondary text-xs p-2 mt-1" data-testid="rename-btn">
                  <PencilSimple size={14} weight="bold" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input className="brut-input" value={title} onChange={(e) => setTitle(e.target.value)}
                  data-testid="rename-input" autoFocus />
                <button onClick={saveTitle} className="brut-btn-mint" data-testid="rename-save">
                  <FloppyDisk size={16} weight="bold" /> Save
                </button>
                <button onClick={() => { setEditingTitle(false); setTitle(doc.title); }}
                  className="brut-btn-secondary" data-testid="rename-cancel">Cancel</button>
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <StatusBadge status={doc.status} />
              <span className="brut-tag">{doc.file_type.toUpperCase()}</span>
              {doc.difficulty && (
                <span className={`brut-tag ${doc.difficulty === "hard" ? "bg-coral" : doc.difficulty === "easy" ? "bg-mint" : "bg-sun"}`}
                  data-testid="difficulty-tag">
                  {doc.difficulty}
                </span>
              )}
              {doc.question_count && <span className="brut-tag">{doc.question_count} Qs</span>}
              <span className="text-xs text-ink/60">{new Date(doc.created_at).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setRegenOpen(true)} className="brut-btn-secondary text-sm" data-testid="regenerate-btn">
              <ArrowsClockwise size={14} weight="bold" /> Regenerate
            </button>
            {doc.quiz && (
              <Link to={`/quiz/${doc.quiz.id}`} className="brut-btn-primary text-sm" data-testid="start-quiz-btn">
                <ListChecks size={14} weight="bold" /> Take quiz <CaretRight size={14} weight="bold" />
              </Link>
            )}
          </div>
        </div>

        {/* Share + Export row */}
        {doc.status === "ready" && doc.summary && (
          <div className="mt-6 pt-6 border-t-2 border-ink/10 grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="actions-row">
            <div className="brut-card p-4 bg-paper">
              <p className="font-heading font-bold text-sm flex items-center gap-2">
                <Share size={16} weight="bold" /> Share public summary
              </p>
              {doc.public_share_token ? (
                <div className="mt-3 space-y-2" data-testid="share-enabled">
                  <div className="flex gap-2 items-center">
                    <input
                      readOnly
                      value={`${window.location.origin}/shared/${doc.public_share_token}`}
                      className="brut-input flex-1 text-xs"
                      data-testid="share-url"
                      onClick={(e) => e.target.select()}
                    />
                    <button onClick={copyShareUrl} className="brut-btn-mint text-xs p-2" data-testid="share-copy">
                      <Copy size={14} weight="bold" />
                    </button>
                  </div>
                  <button
                    onClick={() => toggleShare(false)}
                    disabled={sharing}
                    className="text-xs font-bold text-coral hover:underline"
                    data-testid="share-revoke"
                  >
                    Revoke link
                  </button>
                </div>
              ) : (
                <div className="mt-3">
                  <p className="text-xs text-ink/60 mb-2">Anyone with the link can view the Key Concepts (not the full document or quiz).</p>
                  <button onClick={() => toggleShare(true)} disabled={sharing} className="brut-btn-secondary text-sm" data-testid="share-enable">
                    <LinkIcon size={14} weight="bold" /> {sharing ? "Generating…" : "Generate share link"}
                  </button>
                </div>
              )}
            </div>

            <div className="brut-card p-4 bg-paper">
              <p className="font-heading font-bold text-sm flex items-center gap-2">
                <Download size={16} weight="bold" /> Export Key Concepts
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => downloadFile("pdf")} className="brut-btn-secondary text-sm" data-testid="export-pdf">
                  <FilePdf size={14} weight="bold" /> PDF flashcards
                </button>
                <button onClick={() => downloadFile("anki")} className="brut-btn-secondary text-sm" data-testid="export-anki">
                  <Download size={14} weight="bold" /> Anki deck (.apkg)
                </button>
              </div>
              <p className="text-xs text-ink/60 mt-2">
                Import .apkg into <a className="underline font-bold" href="https://apps.ankiweb.net/" target="_blank" rel="noreferrer">Anki</a> for spaced-repetition.
              </p>
            </div>
          </div>
        )}
      </div>

      {regenOpen && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4" data-testid="regen-modal"
             onClick={() => setRegenOpen(false)}>
          <div className="brut-card p-6 w-full max-w-md bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="brut-badge bg-sun mb-2"><Sparkle size={12} weight="fill" /> Regenerate quiz</p>
                <h3 className="font-heading text-2xl font-black">Tune your next quiz</h3>
                <p className="text-sm text-ink/70 mt-1">The summary will also be refreshed.</p>
              </div>
              <button onClick={() => setRegenOpen(false)} className="p-1"><X size={18} weight="bold" /></button>
            </div>

            <div className="mt-5">
              <label className="text-xs font-bold text-ink/60">Difficulty</label>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {["easy", "medium", "hard"].map((d) => (
                  <button
                    key={d}
                    onClick={() => setRegenDiff(d)}
                    className={`border-2 border-ink rounded-md p-2 text-xs font-bold ${
                      regenDiff === d ? "bg-lavender shadow-brut-sm" : "bg-white hover:bg-paper"
                    }`}
                    data-testid={`regen-diff-${d}`}
                  >
                    {d[0].toUpperCase() + d.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs font-bold text-ink/60 flex justify-between">
                <span>Questions</span>
                <span className="font-heading text-sm font-black" data-testid="regen-count-value">{regenCount}</span>
              </label>
              <input type="range" min={5} max={10} value={regenCount}
                onChange={(e) => setRegenCount(parseInt(e.target.value, 10))}
                className="w-full mt-1 accent-ink" data-testid="regen-count" />
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <button onClick={() => setRegenOpen(false)} className="brut-btn-secondary text-sm" data-testid="regen-cancel">Cancel</button>
              <button onClick={() => regenerate({ difficulty: regenDiff, count: regenCount })}
                className="brut-btn-primary text-sm" data-testid="regen-confirm">
                <ArrowsClockwise size={14} weight="bold" /> Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {doc.status === "processing" && (
        <div className="mt-6 brut-card p-6 bg-sun" data-testid="processing-banner">
          <p className="font-heading font-bold">
            AI is reading your document. Key concepts and quiz will appear here shortly.
          </p>
        </div>
      )}

      {doc.status === "failed" && (
        <div className="mt-6 brut-card p-6 bg-coral" data-testid="failed-banner">
          <p className="font-heading font-bold">AI processing failed.</p>
          <p className="text-sm mt-1">{doc.error}</p>
          <button onClick={() => regenerate()} className="brut-btn-secondary mt-3 text-sm">Try again</button>
        </div>
      )}

      {/* Key concepts */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-bold">Key Concepts</h2>
          {doc.summary && !editingSummary && (
            <button onClick={() => setEditingSummary(true)} className="brut-btn-secondary text-sm" data-testid="edit-summary-btn">
              <PencilSimple size={14} weight="bold" /> Edit
            </button>
          )}
        </div>

        {!doc.summary && doc.status !== "processing" && (
          <p className="mt-2 text-ink/60">No summary yet.</p>
        )}

        {doc.summary && !editingSummary && (
          <ol className="mt-4 grid gap-3" data-testid="concepts-list">
            {(doc.summary.key_concepts || []).map((c, i) => (
              <li key={i} className="brut-card p-4 flex gap-3 items-start">
                <span className="brut-badge bg-lavender">{String(i + 1).padStart(2, "0")}</span>
                <p className="font-body text-[15px] leading-relaxed">{c}</p>
              </li>
            ))}
          </ol>
        )}

        {editingSummary && (
          <div className="mt-4 brut-card p-5" data-testid="summary-editor">
            <div className="space-y-3">
              {concepts.map((c, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="brut-badge bg-lavender mt-2">{String(i + 1).padStart(2, "0")}</span>
                  <textarea
                    className="brut-input flex-1 min-h-[64px]"
                    value={c}
                    onChange={(e) => {
                      const next = [...concepts];
                      next[i] = e.target.value;
                      setConcepts(next);
                    }}
                    data-testid={`concept-input-${i}`}
                  />
                  <button
                    onClick={() => setConcepts(concepts.filter((_, idx) => idx !== i))}
                    className="brut-btn-danger p-2" data-testid={`concept-remove-${i}`}
                  >
                    <Trash size={14} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <button onClick={() => setConcepts([...concepts, ""])} className="brut-btn-secondary text-sm" data-testid="concept-add">
                <Plus size={14} weight="bold" /> Add concept
              </button>
              <button onClick={saveSummary} className="brut-btn-mint text-sm" data-testid="summary-save">
                <FloppyDisk size={14} weight="bold" /> Save changes
              </button>
              <button
                onClick={() => { setEditingSummary(false); setConcepts(doc.summary?.key_concepts || []); }}
                className="brut-btn-secondary text-sm"
                data-testid="summary-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Past attempts */}
      {doc.results?.length > 0 && (
        <section className="mt-10" data-testid="past-attempts">
          <h2 className="font-heading text-2xl font-bold">Your attempts</h2>
          <div className="mt-4 brut-card divide-y-2 divide-ink/10">
            {doc.results.map((r) => (
              <div key={r.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold">{r.score}/{r.total} correct</p>
                  <p className="text-xs text-ink/60">{new Date(r.completed_at).toLocaleString()}</p>
                </div>
                <span className={`brut-badge ${r.percent >= 70 ? "bg-mint" : r.percent >= 40 ? "bg-sun" : "bg-coral"}`}>
                  {r.percent}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default DocumentDetail;
