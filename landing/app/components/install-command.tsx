"use client";

import { useState } from "react";

export function InstallCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="group flex w-full max-w-full items-center gap-3 overflow-x-auto bg-surface-code px-4 py-2.5 text-left font-mono text-sm whitespace-nowrap transition-colors hover:bg-surface-code/80 md:w-fit"
    >
      <span>
        <span className="select-none text-brand-yellow" aria-hidden>
          ${" "}
        </span>
        <span className="text-brand-white">{command}</span>
      </span>
      <span className="text-text-muted opacity-0 transition-opacity group-hover:opacity-100">
        {copied ? "copied!" : "copy"}
      </span>
    </button>
  );
}
