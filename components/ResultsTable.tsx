"use client";

import { useMemo, useState } from "react";
import type { FileResult, FileStatus, ManifestRow, Prediction } from "@/lib/types";
import { SCORED_FIELDS } from "@/lib/scoring";

const PREDICTION_COLSPAN = 9;

type FilterKey = "all" | "succeeded" | "failed" | "mismatched";

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

function isMismatched(result: FileResult, expected: Prediction | null | undefined): boolean {
  if (!expected || result.status !== "succeeded" || !result.prediction) return false;
  return SCORED_FIELDS.some((f) => result.prediction![f] !== expected[f]);
}

interface ResultsTableProps {
  results: FileResult[];
  manifestRows: ManifestRow[];
  hasLabels: boolean;
  onSelect: (result: FileResult) => void;
}

export default function ResultsTable({ results, manifestRows, hasLabels, onSelect }: ResultsTableProps) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

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
      if (filter === "mismatched" && !isMismatched(r, expectedByName.get(r.name))) return false;
      return true;
    });
  }, [results, search, filter, expectedByName]);

  const filters: FilterKey[] = hasLabels ? ["all", "succeeded", "failed", "mismatched"] : ["all", "succeeded", "failed"];

  return (
    <div className="flex flex-col gap-3">
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
              {[
                "Status",
                "File",
                "Tone",
                "Intensity",
                "Noise",
                "Noise type",
                "Severity",
                "Quality",
                "Overlap",
                "Long silence",
                "Confidence",
                "Time",
              ].map((h, i) => (
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
              const mismatched = isMismatched(r, expected);
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
                  ) : r.prediction ? (
                    <>
                      <td className="px-[14px] py-[12px] font-mono whitespace-nowrap">{r.prediction.emotional_tone}</td>
                      <td className="px-[14px] py-[12px] font-mono whitespace-nowrap">{r.prediction.emotional_intensity}</td>
                      <td className="px-[14px] py-[12px] font-mono">{yesNo(r.prediction.background_noise_present)}</td>
                      <td className="px-[14px] py-[12px] text-[var(--text-muted)] whitespace-nowrap">
                        {r.prediction.background_noise_type || "—"}
                      </td>
                      <td className="px-[14px] py-[12px] font-mono whitespace-nowrap">{r.prediction.background_noise_severity}</td>
                      <td className="px-[14px] py-[12px] font-mono whitespace-nowrap">{r.prediction.audio_quality}</td>
                      <td className="px-[14px] py-[12px] font-mono">{yesNo(r.prediction.speaker_overlap_present)}</td>
                      <td className="px-[14px] py-[12px] font-mono">{yesNo(r.prediction.long_silence_present)}</td>
                      <td className="px-[14px] py-[12px] font-mono text-right">{r.prediction.confidence.toFixed(2)}</td>
                    </>
                  ) : (
                    <td className="px-[14px] py-[12px] text-[var(--text-faint)]" colSpan={PREDICTION_COLSPAN}>
                      {r.status}
                    </td>
                  )}
                  <td className="px-[14px] py-[12px] font-mono text-right whitespace-nowrap">
                    {r.processing_ms != null ? `${(r.processing_ms / 1000).toFixed(1)}s` : "—"}
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
