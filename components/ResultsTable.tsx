"use client";

import { useMemo, useState } from "react";
import type { FileResult, FileStatus, ManifestRow, PipelineMode, Prediction } from "@/lib/types";
import { SCORED_FIELDS } from "@/lib/scoring";

const PREDICTION_COLSPAN = 9;

type FilterKey = "all" | "succeeded" | "failed" | "mismatched";
type PipelineView = "hybrid" | "llm_full" | "side_by_side";

const COLUMNS: {
  key: keyof Prediction;
  header: string;
  format: (p: Prediction) => string;
  className?: string;
  align?: "right";
}[] = [
  { key: "emotional_tone", header: "Tone", format: (p) => p.emotional_tone, className: "font-mono whitespace-nowrap" },
  {
    key: "emotional_intensity",
    header: "Intensity",
    format: (p) => p.emotional_intensity,
    className: "font-mono whitespace-nowrap",
  },
  {
    key: "background_noise_present",
    header: "Noise",
    format: (p) => yesNo(p.background_noise_present),
    className: "font-mono",
  },
  {
    key: "background_noise_type",
    header: "Noise type",
    format: (p) => p.background_noise_type || "—",
    className: "text-[var(--text-muted)] whitespace-nowrap",
  },
  {
    key: "background_noise_severity",
    header: "Severity",
    format: (p) => p.background_noise_severity,
    className: "font-mono whitespace-nowrap",
  },
  { key: "audio_quality", header: "Quality", format: (p) => p.audio_quality, className: "font-mono whitespace-nowrap" },
  {
    key: "speaker_overlap_present",
    header: "Overlap",
    format: (p) => yesNo(p.speaker_overlap_present),
    className: "font-mono",
  },
  {
    key: "long_silence_present",
    header: "Long silence",
    format: (p) => yesNo(p.long_silence_present),
    className: "font-mono",
  },
  {
    key: "confidence",
    header: "Confidence",
    format: (p) => p.confidence.toFixed(2),
    className: "font-mono",
    align: "right",
  },
];

function statusColor(status: FileStatus): string {
  switch (status) {
    case "succeeded":
      return "var(--ok)";
    case "failed":
      return "var(--err)";
    default:
      return "var(--text-faint)";
  }
}

function yesNo(v: boolean): string {
  return v ? "yes" : "no";
}

function isMismatched(pred: Prediction | null | undefined, expected: Prediction | null | undefined): boolean {
  if (!expected || !pred) return false;
  return SCORED_FIELDS.some((f) => pred[f] !== expected[f]);
}

function activePrediction(r: FileResult, pipelineMode: PipelineMode, view: PipelineView): Prediction | null {
  if (pipelineMode !== "both") return r.prediction;
  if (view === "llm_full") return r.llm_full_prediction ?? null;
  return r.hybrid_prediction ?? r.prediction;
}

function totalProcessingMs(processing_ms: Record<string, number> | null): number | null {
  if (!processing_ms) return null;
  const values = Object.values(processing_ms);
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
}

interface ResultsTableProps {
  results: FileResult[];
  manifestRows: ManifestRow[];
  hasLabels: boolean;
  pipelineMode: PipelineMode;
  onSelect: (result: FileResult) => void;
}

export default function ResultsTable({ results, manifestRows, hasLabels, pipelineMode, onSelect }: ResultsTableProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [pipelineView, setPipelineView] = useState<PipelineView>("hybrid");

  const expectedByName = useMemo(() => {
    const map = new Map<string, Prediction | null>();
    for (const row of manifestRows) map.set(row.name, row.expected);
    return map;
  }, [manifestRows]);

  const filtered = useMemo(() => {
    return results.filter((r) => {
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "succeeded" && r.status !== "succeeded") return false;
      if (filter === "failed" && r.status !== "failed") return false;
      if (filter === "mismatched") {
        const pred = activePrediction(r, pipelineMode, pipelineView);
        if (!isMismatched(pred, expectedByName.get(r.name))) return false;
      }
      return true;
    });
  }, [results, search, filter, expectedByName, pipelineMode, pipelineView]);

  const filters: FilterKey[] = hasLabels ? ["all", "succeeded", "failed", "mismatched"] : ["all", "succeeded", "failed"];

  return (
    <div className="flex flex-col gap-3">
      {pipelineMode === "both" ? (
        <div className="flex gap-2">
          {(
            [
              { key: "hybrid", label: "Hybrid" },
              { key: "llm_full", label: "Full LLM" },
              { key: "side_by_side", label: "Side by side" },
            ] as { key: PipelineView; label: string }[]
          ).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setPipelineView(v.key)}
              aria-pressed={pipelineView === v.key}
              className="h-[28px] px-3 rounded-[4px] border text-[12px] uppercase tracking-[0.08em]"
              style={{
                borderColor: pipelineView === v.key ? "var(--border-strong)" : "var(--border)",
                background: pipelineView === v.key ? "var(--surface)" : "#fff",
                color: "var(--text)",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {filters.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className="h-[28px] px-3 rounded-[4px] border text-[12px] uppercase tracking-[0.08em]"
              style={{
                borderColor: filter === k ? "var(--border-strong)" : "var(--border)",
                background: filter === k ? "var(--surface)" : "#fff",
                color: "var(--text)",
              }}
            >
              {k}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Filter by filename"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-[36px] px-3 rounded-[4px] border border-[var(--border)] text-[14px] font-mono flex-1 min-w-[200px]"
        />
      </div>

      <div className="overflow-x-auto border border-[var(--border)] rounded-[4px]">
        <table className="w-full border-collapse text-[14px] min-w-[1100px]">
          <thead className="sticky top-0 bg-[var(--surface)]">
            <tr>
              {["Status", "File", ...COLUMNS.map((c) => c.header), "Time"].map((h, i) => (
                <th
                  key={h}
                  className={`px-[14px] py-[12px] text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)] font-normal border-b border-[var(--border)] whitespace-nowrap ${
                    i >= 10 ? "text-right" : "text-left"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const expected = expectedByName.get(r.name);
              const sideBySide = pipelineMode === "both" && pipelineView === "side_by_side";
              const pred = sideBySide ? null : activePrediction(r, pipelineMode, pipelineView);
              const mismatched = !sideBySide && isMismatched(pred, expected);
              const hybridPred = r.hybrid_prediction ?? null;
              const llmPred = r.llm_full_prediction ?? null;

              return (
                <tr
                  key={r.name}
                  onClick={() => onSelect(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSelect(r);
                  }}
                  tabIndex={0}
                  className="border-b border-[var(--border)] last:border-b-0 cursor-pointer hover:bg-[var(--surface)]"
                  style={mismatched ? { boxShadow: "inset 2px 0 0 var(--warn)" } : undefined}
                >
                  <td className="px-[14px] py-[12px] whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block w-[6px] h-[6px] rounded-full"
                        style={{ background: statusColor(r.status) }}
                      />
                      <span className="text-[var(--text)]">{r.status}</span>
                    </span>
                  </td>
                  <td className="px-[14px] py-[12px] font-mono text-[var(--text)] whitespace-nowrap">{r.name}</td>
                  {r.status === "failed" ? (
                    <td className="px-[14px] py-[12px] text-[var(--err)]" colSpan={PREDICTION_COLSPAN}>
                      <span className="font-mono">{r.error?.code}</span> {r.error?.message}
                    </td>
                  ) : sideBySide ? (
                    hybridPred || llmPred ? (
                      COLUMNS.map((c) => {
                        const hv = hybridPred ? c.format(hybridPred) : "—";
                        const lv = llmPred ? c.format(llmPred) : "—";
                        const disagree = !!hybridPred && !!llmPred && hybridPred[c.key] !== llmPred[c.key];
                        return (
                          <td
                            key={c.key}
                            className={`px-[14px] py-[12px] ${c.align === "right" ? "text-right" : ""}`}
                            style={disagree ? { boxShadow: "inset 2px 0 0 var(--warn)" } : undefined}
                          >
                            <div className={c.className}>{hv}</div>
                            <div className={`${c.className ?? ""} text-[var(--text-muted)]`}>{lv}</div>
                          </td>
                        );
                      })
                    ) : (
                      <td className="px-[14px] py-[12px] text-[var(--text-faint)]" colSpan={PREDICTION_COLSPAN}>
                        {r.status}
                      </td>
                    )
                  ) : pred ? (
                    COLUMNS.map((c) => (
                      <td
                        key={c.key}
                        className={`px-[14px] py-[12px] ${c.className ?? ""} ${c.align === "right" ? "text-right" : ""}`}
                      >
                        {c.format(pred)}
                      </td>
                    ))
                  ) : (
                    <td className="px-[14px] py-[12px] text-[var(--text-faint)]" colSpan={PREDICTION_COLSPAN}>
                      {r.status}
                    </td>
                  )}
                  <td className="px-[14px] py-[12px] font-mono text-right whitespace-nowrap">
                    {(() => {
                      const ms = totalProcessingMs(r.processing_ms);
                      return ms != null ? `${(ms / 1000).toFixed(1)}s` : "—";
                    })()}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-[14px] py-[24px] text-center text-[var(--text-faint)]">
                  No files match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
