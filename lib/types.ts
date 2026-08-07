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

export interface FileResult {
  name: string; // original filename, with extension
  status: FileStatus;
  prediction: Prediction | null; // primary — drives existing table/downloads
  hybrid_prediction?: Prediction | null;
  llm_full_prediction?: Prediction | null;
  error: { code: string; message: string } | null;
  processing_ms: Record<string, number> | null;
}

export type BatchStatus = "queued" | "running" | "completed" | "failed";

// Known pipeline mode values. BatchState/ConfigOptions type these as plain
// strings since they come from a backend-driven registry, but the frontend's
// own display logic only knows how to handle these three.
export type PipelineMode = "hybrid" | "llm_full" | "both";

export interface BatchState {
  batch_id: string;
  status: BatchStatus;
  counts: { total: number; completed: number; failed: number };
  files: FileResult[]; // key name is the backend's — see JobStore.get_batch_state
  error?: string; // only when status === "failed"
  pipeline_mode: string;
  gemini_model: string;
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
