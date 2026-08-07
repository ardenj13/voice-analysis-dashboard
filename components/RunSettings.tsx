"use client";

import { useState } from "react";
import type { ConfigOptions } from "@/lib/types";
import { BYTES_PER_MINUTE_ESTIMATE } from "@/lib/cost";

const PIPELINE_LABELS: Record<string, string> = {
  hybrid: "Hybrid (local + Gemini tone)",
  llm_full: "Full LLM (Gemini only)",
  both: "Both (compare side by side)",
};

export function pipelineLongLabel(mode: string): string {
  return PIPELINE_LABELS[mode] ?? mode;
}

export function pipelineShortLabel(mode: string): string {
  return pipelineLongLabel(mode).split(" (")[0];
}

export function modelLabel(configOptions: ConfigOptions | null, id: string): string {
  return configOptions?.models.find((m) => m.id === id)?.label ?? id;
}

function formatCost(n: number): string {
  return `$${n.toFixed(4)}`;
}

interface RunSettingsProps {
  configOptions: ConfigOptions | null;
  pipelineMode: string;
  onPipelineModeChange: (mode: string) => void;
  geminiModel: string;
  onModelChange: (id: string) => void;
  totalBytes: number;
}

export default function RunSettings({
  configOptions,
  pipelineMode,
  onPipelineModeChange,
  geminiModel,
  onModelChange,
  totalBytes,
}: RunSettingsProps) {
  const [open, setOpen] = useState(false);

  if (!configOptions) return null;

  const selectedModel = configOptions.models.find((m) => m.id === geminiModel);
  const totalMinutes = totalBytes / BYTES_PER_MINUTE_ESTIMATE;
  const costPerMin = selectedModel?.estimated_cost_per_min ?? 0;
  const both = pipelineMode === "both";
  const estimatedCost = costPerMin * totalMinutes * (both ? 2 : 1);

  return (
    <div className="border border-[var(--border)] rounded-[4px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span>Run settings</span>
        <span className="flex items-center gap-3 text-[13px] text-[var(--text-muted)] font-mono">
          <span>
            {pipelineShortLabel(pipelineMode)} · {selectedModel?.label ?? geminiModel}
          </span>
          <span>{open ? "−" : "+"}</span>
        </span>
      </button>

      {open ? (
        <div className="border-t border-[var(--border)] px-4 py-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Pipeline mode</span>
            <div className="flex gap-2 flex-wrap">
              {configOptions.pipeline_modes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onPipelineModeChange(mode)}
                  aria-pressed={pipelineMode === mode}
                  className="h-[32px] px-3 rounded-[4px] border text-[13px]"
                  style={{
                    borderColor: pipelineMode === mode ? "var(--border-strong)" : "var(--border)",
                    background: pipelineMode === mode ? "var(--surface)" : "#fff",
                    color: "var(--text)",
                  }}
                >
                  {pipelineLongLabel(mode)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Model</span>
            <select
              value={geminiModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="h-[36px] px-3 rounded-[4px] border border-[var(--border)] text-[14px] font-mono max-w-[420px]"
            >
              {configOptions.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — ~{formatCost(m.estimated_cost_per_min)}/min
                </option>
              ))}
            </select>
            {selectedModel?.notes ? <p className="text-[12px] text-[var(--warn)]">{selectedModel.notes}</p> : null}
          </div>

          {totalMinutes > 0 ? (
            <p className="text-[13px] text-[var(--text-muted)] font-mono">
              Estimated cost: ~{formatCost(costPerMin)}/min × {totalMinutes.toFixed(1)} minutes of audio ≈{" "}
              {formatCost(estimatedCost)} for this batch.
              {both ? " Both mode runs full-LLM in addition to hybrid, so this doubles the estimate." : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
