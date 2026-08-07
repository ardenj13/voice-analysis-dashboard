"use client";

import { useState } from "react";
import type { LedgerEntry, LedgerGroups, LedgerModel } from "@/lib/validate";
import type { ConfigOptions } from "@/lib/types";
import RunSettings from "./RunSettings";

const GROUPS: { key: keyof LedgerGroups; label: string }[] = [
  { key: "matched", label: "Matched" },
  { key: "missingAudio", label: "Missing audio" },
  { key: "unmatchedFiles", label: "Unmatched files" },
  { key: "unsupported", label: "Unsupported" },
  { key: "duplicates", label: "Duplicates" },
  { key: "manifestErrors", label: "Manifest errors" },
];

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

export default function PreflightLedger({
  ledger,
  onRun,
  onClear,
  submitting,
  configOptions,
  pipelineMode,
  onPipelineModeChange,
  geminiModel,
  onModelChange,
}: {
  ledger: LedgerModel;
  onRun: () => void;
  onClear: () => void;
  submitting: boolean;
  configOptions: ConfigOptions | null;
  pipelineMode: string;
  onPipelineModeChange: (mode: string) => void;
  geminiModel: string;
  onModelChange: (id: string) => void;
}) {
  const hasWarnings =
    ledger.counts.missingAudio +
      ledger.counts.unmatchedFiles +
      ledger.counts.unsupported +
      ledger.counts.duplicates +
      ledger.counts.manifestErrors >
    0;

  const blocked = !!ledger.blockingReason;

  return (
    <section className="flex flex-col gap-6" aria-label="Pre-flight ledger">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-[var(--border)] border border-[var(--border)] rounded-[4px] overflow-hidden">
        <Stat label="Matched" value={ledger.counts.matched} />
        <Stat label="Missing audio" value={ledger.counts.missingAudio} warn={ledger.counts.missingAudio > 0} />
        <Stat label="Unmatched files" value={ledger.counts.unmatchedFiles} warn={ledger.counts.unmatchedFiles > 0} />
        <Stat label="Unsupported" value={ledger.counts.unsupported} warn={ledger.counts.unsupported > 0} />
        <Stat label="Duplicates" value={ledger.counts.duplicates} warn={ledger.counts.duplicates > 0} />
        <Stat label="Manifest errors" value={ledger.counts.manifestErrors} warn={ledger.counts.manifestErrors > 0} />
      </div>

      {blocked ? <p className="text-[14px] text-[var(--err)]">{ledger.blockingReason}</p> : null}

      {ledger.sizeWarningBytes > 0 ? (
        <p className="text-[14px] text-[var(--warn)]">
          Large batch — {formatBytes(ledger.sizeWarningBytes)}. Upload may take several minutes.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 font-mono text-[14px]">
        {GROUPS.map((g) => {
          const entries = ledger.groups[g.key];
          return <Group key={g.key} label={g.label} entries={entries} defaultOpen={g.key !== "matched" && entries.length > 0} />;
        })}

        {ledger.warnings.length > 0 ? (
          <Group
            label="Warnings"
            entries={ledger.warnings.map((w) => ({ filename: "", reason: w }))}
            defaultOpen
            freeform
          />
        ) : null}
      </div>

      <RunSettings
        configOptions={configOptions}
        pipelineMode={pipelineMode}
        onPipelineModeChange={onPipelineModeChange}
        geminiModel={geminiModel}
        onModelChange={onModelChange}
        totalBytes={ledger.toProcess.reduce((sum, f) => sum + f.size, 0)}
      />

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="btn-primary" disabled={blocked || submitting} onClick={onRun}>
          {hasWarnings ? "Run analysis anyway" : "Run analysis"}
        </button>
        <button type="button" className="btn-secondary" onClick={onClear} disabled={submitting}>
          Clear batch
        </button>
        {!blocked ? (
          <span className="text-[12px] text-[var(--text-muted)] font-mono">
            {ledger.skippedFileCount > 0 ? `${ledger.skippedFileCount} files will be skipped. ` : ""}
            {ledger.toProcess.length} will be processed.
          </span>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="bg-[var(--surface)] px-4 py-3 flex flex-col gap-1">
      <span className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</span>
      <span className="text-[16px] font-mono" style={{ color: warn ? "var(--warn)" : "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}

function Group({
  label,
  entries,
  defaultOpen,
  freeform,
}: {
  label: string;
  entries: LedgerEntry[];
  defaultOpen: boolean;
  freeform?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[var(--border)] rounded-[4px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span>
          {label} — {entries.length}
        </span>
        <span className="text-[var(--text-muted)]">{open ? "−" : "+"}</span>
      </button>
      {open && entries.length > 0 ? (
        <div className="border-t border-[var(--border)] px-4 py-2 flex flex-col gap-1 max-h-[320px] overflow-y-auto">
          {entries.map((e, i) => (
            <div key={`${e.filename}-${i}`} className="flex flex-wrap justify-between gap-x-4">
              {!freeform ? <span className="text-[var(--text)]">{e.filename}</span> : null}
              <span className="text-[var(--text-muted)]">{e.reason}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
