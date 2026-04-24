import React, { useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DocumentCard from "@/components/DocumentCard";
import Uploader from "@/components/Uploader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sparkle, BookOpenText, EnvelopeSimple } from "@phosphor-icons/react";
import { toast } from "sonner";

const EMPTY_IMG = "https://images.pexels.com/photos/1509485/pexels-photo-1509485.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const VerifyBanner = () => {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const resend = async () => {
    setBusy(true);
    try {
      await api.post("/auth/resend-verification");
      setSent(true);
      toast.success("Verification link generated (check backend logs)");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(false); }
  };
  return (
    <div className="brut-card p-4 bg-sun flex items-start sm:items-center gap-3 flex-wrap mb-6" data-testid="verify-banner">
      <EnvelopeSimple size={20} weight="bold" className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-heading font-bold">Verify your email</p>
        <p className="text-sm text-ink/80">
          Your account works — verification just confirms the email is yours. In demo mode the link is printed to the backend console.
        </p>
      </div>
      <button onClick={resend} disabled={busy || sent} className="brut-btn-secondary text-xs" data-testid="resend-verify">
        {sent ? "Link generated ✓" : busy ? "Sending…" : "Send link"}
      </button>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/documents");
      setDocs(data);
      setLoadError(null);
    } catch (e) {
      // Only show error if it's not a 401 (401 is handled by redirect)
      if (e.response?.status !== 401) {
        setLoadError(formatApiErrorDetail(e.response?.data?.detail) + " | Debug: " + (e.message || String(e)));
      }
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => {
      setDocs((prev) => {
        if (!prev) return prev;
        const hasProcessing = prev.some((d) => d.status === "processing");
        if (hasProcessing) load();
        return prev;
      });
    }, 4000);
    return () => clearInterval(id);
  }, [load]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await api.delete(`/documents/${toDelete.id}`);
      toast.success("Document deleted");
      setDocs((prev) => prev.filter((d) => d.id !== toDelete.id));
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {user && user.email_verified === false && <VerifyBanner />}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-end lg:justify-between">
        <div>
          <span className="brut-badge bg-mint mb-3">
            <Sparkle size={12} weight="fill" /> Powered by Gemini AI
          </span>
          <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight">
            Hi {user?.name?.split(" ")[0] || "there"}, what are we learning today?
          </h1>
          <p className="mt-2 text-ink/70 max-w-xl">
            Drop a PDF or text file and I'll distil it into key concepts and a quiz in about 20 seconds.
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Uploader onUploaded={(d) => setDocs((prev) => [d, ...(prev || [])])} />
        </div>
        <div className="lg:col-span-2">
          <div className="brut-card p-6 h-full">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-xl font-bold flex items-center gap-2">
                <BookOpenText size={20} weight="duotone" /> Study Library
                {docs && <span className="brut-tag">{docs.length}</span>}
              </h2>
            </div>
            <p className="text-sm text-ink/60 mt-1">
              All your uploaded documents, with processing status in real time.
            </p>
          </div>
        </div>
      </div>

      <section className="mt-10" data-testid="library-section">
        {docs === null && !loadError && <p className="text-ink/60 font-bold">Loading library…</p>}

        {loadError && (
          <div className="brut-card p-6 bg-coral/10 border-coral flex gap-3 items-start">
            <span className="font-heading font-bold text-coral">Error loading library:</span>
            <span className="text-sm">{loadError}</span>
            <button onClick={load} className="ml-auto brut-btn-secondary text-xs shrink-0">Retry</button>
          </div>
        )}


        {docs && docs.length === 0 && (
          <div className="brut-card p-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-center" data-testid="library-empty">
            <div>
              <h3 className="font-heading text-2xl font-bold">Your library is empty.</h3>
              <p className="mt-2 text-ink/70">
                Upload your first study document using the uploader above. StudyFlow will
                automatically extract key concepts and generate a short quiz.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2"><span className="brut-tag bg-mint">01</span> Upload</li>
                <li className="flex items-center gap-2"><span className="brut-tag bg-sun">02</span> AI extracts concepts</li>
                <li className="flex items-center gap-2"><span className="brut-tag bg-lavender">03</span> Take the quiz</li>
              </ul>
            </div>
            <img src={EMPTY_IMG} alt="Notebooks"
              className="border-2 border-ink rounded-md shadow-brut w-full object-cover h-64" />
          </div>
        )}

        {docs && docs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="library-grid">
            {docs.map((d) => (
              <DocumentCard key={d.id} doc={d} onDelete={setToDelete} />
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{toDelete?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the document, its AI summary and all quiz results.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} data-testid="delete-confirm"
              className="bg-coral text-ink border-2 border-ink shadow-brut hover:bg-coral/90">
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
