import React from "react";
import { CircleNotch } from "@phosphor-icons/react";

const Loader = ({ label = "Loading…" }) => (
  <div className="min-h-[40vh] flex items-center justify-center" data-testid="loader">
    <div className="flex items-center gap-3 font-heading font-bold">
      <CircleNotch className="animate-spin" size={20} weight="bold" />
      {label}
    </div>
  </div>
);

export default Loader;
