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

export type FileStatus = "pending" | "processing" | "succeeded" | "failed";

export interface FileResult {
  name: string; // original filename, with extension
  status: FileStatus;
  prediction: Prediction | null;
  error: { code: string; message: string } | null;
  processing_ms: number | null;
}

export type BatchStatus = "queued" | "running" | "completed" | "failed";

export interface BatchState {
  batch_id: string;
  status: BatchStatus;
  counts: { total: number; completed: number; failed: number };
  results: FileResult[];
  error?: string; // only when status === "failed"
}

// Expected labels parsed from the manifest, held client-side only.
export interface ManifestRow {
  name: string;
  expected: Prediction | null; // null when result_json empty/absent
  rawResultJson: string;
  parseError?: string;
}
