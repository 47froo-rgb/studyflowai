import React from "react";
import { Link } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import { FilePdf, FileText, CaretRight, Trash } from "@phosphor-icons/react";

const DocumentCard = ({ doc, onDelete }) => {
  const Icon = doc.file_type === "pdf" ? FilePdf : FileText;
  const created = new Date(doc.created_at).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div
      className="brut-card-hover p-6 flex flex-col gap-4 animate-fade-up"
      data-testid={`doc-card-${doc.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center bg-lavender border-2 border-ink rounded-md">
            <Icon size={22} weight="duotone" />
          </span>
          <div>
            <h3 className="font-heading text-lg font-bold leading-tight line-clamp-2" data-testid={`doc-title-${doc.id}`}>
              {doc.title}
            </h3>
            <p className="text-xs text-ink/60 mt-1">{created} · {(doc.file_type || "file").toUpperCase()}</p>
          </div>
        </div>
        <StatusBadge status={doc.status} />
      </div>

      <p className="text-sm text-ink/70 line-clamp-3">{doc.content_preview}</p>

      <div className="flex items-center justify-between pt-2 mt-auto">
        <button
          onClick={() => onDelete(doc)}
          className="inline-flex items-center gap-1 text-xs font-bold text-ink/70 hover:text-coral transition-colors"
          data-testid={`doc-delete-${doc.id}`}
        >
          <Trash size={14} weight="bold" /> Delete
        </button>
        <Link
          to={`/documents/${doc.id}`}
          className="brut-btn-primary text-sm px-3 py-1.5"
          data-testid={`doc-open-${doc.id}`}
        >
          Open <CaretRight size={14} weight="bold" />
        </Link>
      </div>
    </div>
  );
};

export default DocumentCard;
