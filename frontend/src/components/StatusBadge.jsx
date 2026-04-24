import React from "react";
import { CircleNotch, CheckCircle, Warning } from "@phosphor-icons/react";

const variants = {
  processing: { cls: "bg-sun", Icon: CircleNotch, label: "Processing" },
  ready: { cls: "bg-mint", Icon: CheckCircle, label: "Ready" },
  failed: { cls: "bg-coral", Icon: Warning, label: "Failed" },
};

const StatusBadge = ({ status }) => {
  const v = variants[status] || variants.processing;
  const { Icon } = v;
  return (
    <span className={`brut-badge ${v.cls}`} data-testid={`status-${status}`}>
      <Icon size={12} weight="bold" className={status === "processing" ? "animate-spin" : ""} />
      {v.label}
    </span>
  );
};

export default StatusBadge;
