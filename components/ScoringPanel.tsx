"use client";

import type { FileResult, ManifestRow, PipelineMode } from "@/lib/types";
import { computeScoring, type ScoringResult } from "@/lib/scoring";
import ConfusionMatrix from "./ConfusionMatrix";

function meanFieldAccuracyPct(scoring: ScoringResult): number {
  if (scoring.fieldAccuracy.length === 0) return 0;
  return (scoring.fieldAccuracy.reduce((sum, f) => sum + f.pct, 0) / scoring.fieldAccuracy.length) * 100;
}

// A pipeline that produced no predictions at all scores 0/0 on every field,
// which renders identically to a pipeline that got everything wrong. Callers
// use this to say "unavailable" instead of a wall of 0%.
function hasNoPredictions(scoring: ScoringResult): boolean {
  return scoring.scoredCount === 0;
}

function summaryFor(label: string, scoring: ScoringResult): string {
  return hasNoPredictions(scoring)
    ? `${label}: no predictions returned`
    : `${label}: ${meanFieldAccuracyPct(scoring).toFixed(0)}% mean field accuracy`;
}

export default function ScoringPanel({
  results,
  manifestRows,
  pipelineMode,
}: {
  results: FileResult[];
  manifestRows: ManifestRow[];
  pipelineMode: PipelineMode;
}) {
  if (pipelineMode === "both") {
    const scoringHybrid = computeScoring(results, manifestRows, "hybrid_prediction");
    const scoringLlmFull = computeScoring(results, manifestRows, "llm_full_prediction");
    if (!scoringHybrid || !scoringLlmFull) return null;

    return (
      <section className="flex flex-col gap-4">
        <p className="text-[13px] text-[var(--text-muted)] font-mono">
          Scored on {Math.max(scoringHybrid.scoredCount, scoringLlmFull.scoredCount)} files.{" "}
          {summaryFor("Hybrid", scoringHybrid)}. {summaryFor("Full LLM", scoringLlmFull)}.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScoringPanelBody title="Hybrid" scoring={scoringHybrid} stackedInner />
          <ScoringPanelBody title="Full LLM" scoring={scoringLlmFull} stackedInner />
        </div>
      </section>
    );
  }

  const scoring = computeScoring(results, manifestRows, "prediction");
  if (!scoring) return null;

  return <ScoringPanelBody title="Scoring" scoring={scoring} />;
}

function ScoringPanelBody({
  title,
  scoring,
  stackedInner,
}: {
  title: string;
  scoring: ScoringResult;
  stackedInner?: boolean;
}) {
  const unlabelled = scoring.totalWithResults - scoring.scoredCount;

  return (
    <section className="border border-[var(--border)] rounded-[4px] p-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-medium tracking-tight">{title}</h2>
        <p className="text-[12px] text-[var(--text-muted)] font-mono">
          Scored on {scoring.scoredCount} of {scoring.totalWithResults} files.
          {unlabelled > 0 ? ` ${unlabelled} file${unlabelled === 1 ? "" : "s"} had no label.` : ""}
        </p>
      </div>

      {hasNoPredictions(scoring) ? (
        <p className="text-[13px] text-[var(--warn)]">
          This pipeline returned no predictions for any file, so there is nothing to score. Check the run&apos;s Gemini
          model — an unreachable model fails every call and leaves this leg empty. These are not 0% accuracy results.
        </p>
      ) : (
        <>

      <div className={`grid grid-cols-1 gap-6 ${stackedInner ? "" : "lg:grid-cols-2"}`}>
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
        <p className="text-[12px] text-[var(--text-muted)] mt-2">
          Computed from {scoring.scoredCount} labeled file{scoring.scoredCount === 1 ? "" : "s"}. Not a validation
          result — see technical memo §4.
        </p>
      </div>
        </>
      )}
    </section>
  );
}
