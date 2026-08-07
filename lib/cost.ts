import type { BatchState, CostTotals, FileResult, PipelineMode } from "./types";

// Duration isn't parsed client-side, so estimate audio length from file size —
// ~1MB/min is a reasonable proxy for typical compressed call-recording audio.
// Only used as a fallback: a completed batch reports real durations (see
// totalAudioSeconds).
export const BYTES_PER_MINUTE_ESTIMATE = 1024 * 1024;

// Cloud Run tier-1 published rates, applied to measured wall time. This is an
// estimate rather than a billed figure: it prices the time the pipeline spent
// on a request, not the instance-seconds Google actually invoices (which
// include idle time on the always-warm min-instances 1 container).
const VCPU_USD_PER_SEC = 0.000018;
const GIB_USD_PER_SEC = 0.000002;
const DEPLOY_VCPU = 2; // --cpu 2   } both from the Cloud Run deploy in the
const DEPLOY_GIB = 8; //  --memory 8Gi }  backend README

export const COMPUTE_USD_PER_SEC = DEPLOY_VCPU * VCPU_USD_PER_SEC + DEPLOY_GIB * GIB_USD_PER_SEC;

// Mirrors ModelSpec.audio_in_per_m / text_out_per_m in the backend's
// app/model_registry.py. /v1/config/options only exposes the derived
// estimated_cost_per_min, so the per-token rates have to be repeated here to
// price a batch's actual measured token counts. A model missing from this
// table falls back to the per-minute estimate — see legCost().
const MODEL_TOKEN_RATES: Record<string, { audioInPerM: number; textOutPerM: number }> = {
  "gemini-2.5-flash-lite": { audioInPerM: 0.3, textOutPerM: 0.4 },
  "gemini-3.5-flash-lite": { audioInPerM: 0.3, textOutPerM: 2.5 },
  "gemini-3.1-flash-lite": { audioInPerM: 0.5, textOutPerM: 1.5 },
  "gemini-3-flash-preview": { audioInPerM: 1.0, textOutPerM: 3.0 },
};

export type CostLegId = "hybrid" | "llm_full";

export interface CostLeg {
  id: CostLegId;
  label: string;
  inputTokens: number;
  outputTokens: number;
  /** Priced from measured token counts when the model's rates are known. */
  apiUsd: number;
  apiRatesKnown: boolean;
  computeUsd: number;
  totalUsd: number;
  /** Per audio-minute figures — 0 when the batch reports no audio duration. */
  apiPerMin: number;
  computePerMin: number;
  totalPerMin: number;
  /** totalPerMin / ceiling. 0 when there is no duration to divide by. */
  ceilingRatio: number;
}

export interface CostReport {
  audioMinutes: number;
  audioMinutesEstimated: boolean; // true when derived from file size, not measured
  ceilingPerMin: number;
  legs: CostLeg[];
}

/** Sums measured audio duration across the batch. Only the hybrid leg carries
 *  ingest evidence, so an llm_full-only batch returns 0 and the caller falls
 *  back to the byte estimate. */
export function totalAudioSeconds(files: FileResult[]): number {
  let seconds = 0;
  for (const f of files) {
    const d = f.hybrid_evidence?.ingest?.duration_sec;
    if (typeof d === "number" && Number.isFinite(d)) seconds += d;
  }
  return seconds;
}

function legsFor(mode: PipelineMode): CostLegId[] {
  if (mode === "both") return ["hybrid", "llm_full"];
  return mode === "llm_full" ? ["llm_full"] : ["hybrid"];
}

export const LEG_LABELS: Record<CostLegId, string> = {
  hybrid: "Hybrid",
  llm_full: "Full LLM",
};

function legCost(
  id: CostLegId,
  totals: CostTotals,
  geminiModel: string,
  audioMinutes: number,
  fallbackUsdPerMin: number
): CostLeg {
  const inputTokens = id === "hybrid" ? totals.hybrid_tone_input_tokens : totals.llm_full_input_tokens;
  const outputTokens = id === "hybrid" ? totals.hybrid_tone_output_tokens : totals.llm_full_output_tokens;
  const totalMs = id === "hybrid" ? totals.hybrid_total_ms : totals.llm_full_total_ms;

  const rates = MODEL_TOKEN_RATES[geminiModel];
  const apiUsd = rates
    ? (inputTokens / 1_000_000) * rates.audioInPerM + (outputTokens / 1_000_000) * rates.textOutPerM
    : fallbackUsdPerMin * audioMinutes;

  const computeUsd = (totalMs / 1000) * COMPUTE_USD_PER_SEC;
  const totalUsd = apiUsd + computeUsd;
  const perMin = (usd: number) => (audioMinutes > 0 ? usd / audioMinutes : 0);

  return {
    id,
    label: LEG_LABELS[id],
    inputTokens,
    outputTokens,
    apiUsd,
    apiRatesKnown: rates !== undefined,
    computeUsd,
    totalUsd,
    apiPerMin: perMin(apiUsd),
    computePerMin: perMin(computeUsd),
    totalPerMin: perMin(totalUsd),
    ceilingRatio: 0, // filled in by buildCostReport, which knows the ceiling
  };
}

/** Returns null when the batch carries no cost totals at all — a batch where
 *  every file failed, or a response from a backend that predates cost_totals. */
export function buildCostReport(
  batch: BatchState,
  mode: PipelineMode,
  ceilingPerMin: number,
  fallbackBytes: number,
  fallbackUsdPerMin: number
): CostReport | null {
  const totals = batch.cost_totals;
  if (!totals || totals.files_counted === 0) return null;

  const measuredSeconds = totalAudioSeconds(batch.files);
  const audioMinutesEstimated = measuredSeconds === 0;
  const audioMinutes = audioMinutesEstimated
    ? fallbackBytes / BYTES_PER_MINUTE_ESTIMATE
    : measuredSeconds / 60;

  const legs = legsFor(mode).map((id) => {
    const leg = legCost(id, totals, batch.gemini_model, audioMinutes, fallbackUsdPerMin);
    return { ...leg, ceilingRatio: ceilingPerMin > 0 ? leg.totalPerMin / ceilingPerMin : 0 };
  });

  return { audioMinutes, audioMinutesEstimated, ceilingPerMin, legs };
}

// ---------------------------------------------------------------------------
// Latency
// ---------------------------------------------------------------------------

export interface StageShare {
  stage: string; // "quality", "vad", ... — the timing key minus its _ms suffix
  ms: number;
  pct: number; // share of summed stage time, 0-1
}

export interface LatencyLeg {
  id: CostLegId;
  label: string;
  clipCount: number;
  p50Ms: number;
  p95Ms: number;
  totalMs: number;
  msPerAudioMinute: number;
  /** Compute-seconds per second of audio. */
  rtf: number;
  /** Empty for the llm_full leg — a single Gemini call has no stage timing. */
  stages: StageShare[];
}

export interface LatencyReport {
  audioMinutes: number;
  legs: LatencyLeg[];
}

/** Nearest-rank percentile. At the n=3 batch sizes this dashboard is used with,
 *  p95 is just the slowest clip — which is the honest answer, not a defect. */
function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const rank = Math.ceil(p * sortedMs.length);
  return sortedMs[Math.min(sortedMs.length - 1, Math.max(0, rank - 1))];
}

function stageShares(files: FileResult[]): StageShare[] {
  const byStage = new Map<string, number>();
  for (const f of files) {
    const timing = f.hybrid_evidence?.timing;
    if (!timing) continue;
    for (const [key, ms] of Object.entries(timing)) {
      // total_ms is the sum of the others — including it would double-count.
      if (key === "total_ms" || !key.endsWith("_ms")) continue;
      if (typeof ms !== "number" || !Number.isFinite(ms)) continue;
      byStage.set(key.slice(0, -3), (byStage.get(key.slice(0, -3)) ?? 0) + ms);
    }
  }

  const sum = Array.from(byStage.values()).reduce((a, b) => a + b, 0);
  if (sum <= 0) return [];

  return Array.from(byStage.entries())
    .map(([stage, ms]) => ({ stage, ms, pct: ms / sum }))
    .sort((a, b) => b.ms - a.ms);
}

export function buildLatencyReport(
  batch: BatchState,
  mode: PipelineMode,
  fallbackBytes: number
): LatencyReport | null {
  const succeeded = batch.files.filter((f) => f.status === "succeeded");
  if (succeeded.length === 0) return null;

  const measuredSeconds = totalAudioSeconds(batch.files);
  const audioMinutes = measuredSeconds > 0 ? measuredSeconds / 60 : fallbackBytes / BYTES_PER_MINUTE_ESTIMATE;
  const shares = stageShares(succeeded);

  const legs: LatencyLeg[] = [];
  for (const id of legsFor(mode)) {
    const perClip = succeeded
      .map((f) => f.processing_ms?.[id])
      .filter((ms): ms is number => typeof ms === "number" && Number.isFinite(ms))
      .sort((a, b) => a - b);
    if (perClip.length === 0) continue;

    const totalMs = perClip.reduce((a, b) => a + b, 0);
    legs.push({
      id,
      label: LEG_LABELS[id],
      clipCount: perClip.length,
      p50Ms: percentile(perClip, 0.5),
      p95Ms: percentile(perClip, 0.95),
      totalMs,
      msPerAudioMinute: audioMinutes > 0 ? totalMs / audioMinutes : 0,
      rtf: audioMinutes > 0 ? totalMs / 1000 / (audioMinutes * 60) : 0,
      stages: id === "hybrid" ? shares : [],
    });
  }

  return legs.length > 0 ? { audioMinutes, legs } : null;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** 4dp is enough for every batch-level figure; sub-$0.001 per-minute rates
 *  need a fifth to stay above one significant digit. */
export function usd(n: number): string {
  return `$${n.toFixed(n > 0 && n < 0.001 ? 5 : 4)}`;
}

export function tokens(n: number): string {
  return n.toLocaleString("en-US");
}

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
