import type { ScoringResult } from "./scoring";

export type EmotionalTone =
  | "neutral"
  | "satisfied"
  | "frustrated"
  | "upset"
  | "distressed";

export type EmotionalIntensity = "low" | "medium" | "high";

export type NoiseSeverity = "none" | "low" | "medium" | "high";

export type AudioQuality = "clear" | "slightly_impaired" | "severely_impaired";

export interface Prediction {
  emotional_tone: EmotionalTone;
  emotional_intensity: EmotionalIntensity;
  background_noise_present: boolean;
  background_noise_type: string; // "" when no noise present
  background_noise_severity: NoiseSeverity;
  audio_quality: AudioQuality;
  speaker_overlap_present: boolean;
  long_silence_present: boolean;
  confidence: number; // 0.0 - 1.0
}

// Mirrors app/schemas.py FileStatus — the backend writes these exact strings
// into batch_files.status, and ResultsTable renders them verbatim.
export type FileStatus = "queued" | "running" | "succeeded" | "failed";

// Mirrors app/schemas.py StageTiming. Every key is wall time in ms for one
// hybrid stage; total_ms is the sum, so stage breakdowns must exclude it.
export interface StageTiming {
  ingest_ms: number;
  vad_ms: number;
  noise_ms: number;
  events_ms: number;
  quality_ms: number;
  overlap_ms: number;
  tone_ms: number;
  fuse_ms: number;
  total_ms: number;
}

// The backend serialises Evidence as an untyped dict, so only the parts the
// cost/latency panels read are declared here — everything is optional because
// an older batch, or a file that failed mid-pipeline, may carry neither.
export interface HybridEvidence {
  ingest?: { duration_sec?: number; codec?: string; sample_rate?: number };
  tone?: { input_tokens?: number; output_tokens?: number };
  timing?: Partial<StageTiming>;
}

export interface LlmFullEvidence {
  input_tokens?: number;
  output_tokens?: number;
  llm_unavailable?: boolean;
  gemini_model?: string;
}

export interface FileResult {
  name: string; // original filename, with extension
  status: FileStatus;
  prediction: Prediction | null; // primary — drives existing table/downloads
  hybrid_prediction?: Prediction | null;
  llm_full_prediction?: Prediction | null;
  hybrid_evidence?: HybridEvidence | null;
  llm_full_evidence?: LlmFullEvidence | null;
  error: { code: string; message: string } | null;
  processing_ms: Record<string, number> | null;
}

export type BatchStatus = "queued" | "running" | "completed" | "failed";

// Known pipeline mode values. BatchState/ConfigOptions type these as plain
// strings since they come from a backend-driven registry, but the frontend's
// own display logic only knows how to handle these three.
export type PipelineMode = "hybrid" | "llm_full" | "both";

// Mirrors _summarize_costs() in the backend's app/main.py — measured totals
// summed over succeeded files only, so it can be zero on a batch where every
// file failed.
export interface CostTotals {
  files_counted: number;
  hybrid_total_ms: number;
  llm_full_total_ms: number;
  hybrid_tone_input_tokens: number;
  hybrid_tone_output_tokens: number;
  llm_full_input_tokens: number;
  llm_full_output_tokens: number;
}

export interface BatchState {
  batch_id: string;
  status: BatchStatus;
  counts: { total: number; completed: number; failed: number };
  files: FileResult[]; // key name is the backend's — see JobStore.get_batch_state
  error?: string; // only when status === "failed"
  pipeline_mode: string;
  gemini_model: string;
  cost_totals?: CostTotals | null;
  scoring_hybrid?: ScoringResult | null;
  scoring_llm_full?: ScoringResult | null;
}

export interface ModelOption {
  id: string;
  label: string;
  estimated_cost_per_min: number;
  notes: string;
}

export interface ConfigOptions {
  pipeline_modes: string[];
  default_pipeline_mode: string;
  models: ModelOption[];
  default_model: string;
  cost_ceiling_per_min: number;
}

// Expected labels parsed from the manifest, held client-side only.
export interface ManifestRow {
  name: string;
  expected: Prediction | null; // null when result_json empty/absent
  rawResultJson: string;
  parseError?: string;
}
