"use client";

import type { FileResult, ManifestRow } from "@/lib/types";
import { computeScoring } from "@/lib/scoring";
import ConfusionMatrix from "./ConfusionMatrix";

export default function ScoringPanel({ results, manifestRows }: { results: FileResult[]; manifestRows: ManifestRow[] }) {
  const scoring = computeScoring(results, manifestRows);
  if (!scoring) return null;

  const unlabelled = scoring.totalWithResults - scoring.scoredCount;

  return (
    <section className="border border-[var(--border)] rounded-[4px] p-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-medium tracking-tight">Scoring</h2>
        <p className="text-[12px] text-[var(--text-muted)] font-mono">
          Scored on {scoring.scoredCount} of {scoring.totalWithResults} files.
          {unlabelled > 0 ? ` ${unlabelled} file${unlabelled === 1 ? "" : "s"} had no label.` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-2">Per-field accuracy</h3>
          <table className="w-full text-[14px] border-collapse">
            <tbody>
              {scoring.fieldAccuracy.map((f) => (
                <tr key={f.field} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="py-2 pr-3 font-mono">{f.field}</td>
                  <td className="py-2 pr-3 font-mono text-right whitespace-nowrap">
                    {f.correct}/{f.total}
                  </td>
                  <td className="py-2 font-mono text-right">{(f.pct * 100).toFixed(0)}%</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 pr-3 font-mono text-[var(--text-muted)]">confidence (MAE)</td>
                <td className="py-2 pr-3"></td>
                <td className="py-2 font-mono text-right">{scoring.confidenceMae.toFixed(3)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-2">
            Emotional tone — macro F1 {(scoring.macroF1 * 100).toFixed(1)}%
          </h3>
          <table className="w-full text-[14px] border-collapse">
            <thead>
              <tr className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                <th className="text-left py-2 font-normal">Class</th>
                <th className="text-right py-2 font-normal">Precision</th>
                <th className="text-right py-2 font-normal">Recall</th>
                <th className="text-right py-2 font-normal">F1</th>
                <th className="text-right py-2 font-normal">N</th>
              </tr>
            </thead>
            <tbody>
              {scoring.classMetrics.map((c) => (
                <tr key={c.label} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="py-2 font-mono">{c.label}</td>
                  <td className="py-2 font-mono text-right">{(c.precision * 100).toFixed(0)}%</td>
                  <td className="py-2 font-mono text-right">{(c.recall * 100).toFixed(0)}%</td>
                  <td className="py-2 font-mono text-right">{(c.f1 * 100).toFixed(0)}%</td>
                  <td className="py-2 font-mono text-right">{c.support}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)] mb-2">
          Confusion matrix — emotional tone
        </h3>
        <ConfusionMatrix matrix={scoring.confusionMatrix} labels={scoring.toneLabels} />
      </div>
    </section>
  );
}
