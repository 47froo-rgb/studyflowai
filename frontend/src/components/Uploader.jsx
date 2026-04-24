import React, { useRef, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { UploadSimple, FilePlus, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy", hint: "Recall facts" },
  { value: "medium", label: "Medium", hint: "Understanding" },
  { value: "hard", label: "Hard", hint: "Application" },
];

const Uploader = ({ onUploaded }) => {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState(8);

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "txt", "md"].includes(ext)) {
      toast.error("Only PDF, TXT, or MD files are supported");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("difficulty", difficulty);
      fd.append("question_count", String(count));
      const { data } = await api.post("/documents/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Uploaded! AI is processing…");
      onUploaded?.(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer select-none rounded-md border-2 border-dashed border-ink p-10 text-center transition-colors ${
          drag ? "bg-sun" : "bg-white"
        }`}
        data-testid="upload-dropzone"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="upload-file-input"
        />
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center bg-lavender border-2 border-ink rounded-md shadow-brut-sm">
            <UploadSimple size={26} weight="bold" />
          </span>
          <div>
            <p className="font-heading font-bold text-lg">
              {loading ? "Uploading…" : "Drop a PDF or text file"}
            </p>
            <p className="text-sm text-ink/60">or click to browse · Max 10MB · .pdf .txt .md</p>
          </div>
          {!loading && (
            <span className="brut-btn-accent text-sm mt-2">
              <FilePlus size={16} weight="bold" /> Choose file
            </span>
          )}
        </div>
      </div>

      <div className="brut-card p-4" onClick={(e) => e.stopPropagation()}>
        <p className="font-heading font-bold text-sm flex items-center gap-2">
          <Sparkle size={14} weight="fill" /> Quiz options
        </p>
        <div className="mt-3">
          <label className="text-xs font-bold text-ink/60">Difficulty</label>
          <div className="mt-1 grid grid-cols-3 gap-2" data-testid="difficulty-group">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setDifficulty(opt.value)}
                className={`border-2 border-ink rounded-md p-2 text-xs font-bold transition-all ${
                  difficulty === opt.value ? "bg-lavender shadow-brut-sm" : "bg-white hover:bg-paper"
                }`}
                data-testid={`difficulty-${opt.value}`}
              >
                <div>{opt.label}</div>
                <div className="text-[10px] font-normal text-ink/60">{opt.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <label className="text-xs font-bold text-ink/60 flex items-center justify-between">
            <span>Questions</span>
            <span className="font-heading text-sm font-black" data-testid="count-value">{count}</span>
          </label>
          <input
            type="range" min={5} max={10} step={1}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10))}
            className="w-full mt-1 accent-ink"
            data-testid="count-range"
          />
          <div className="flex justify-between text-[10px] text-ink/50 mt-1">
            <span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Uploader;
