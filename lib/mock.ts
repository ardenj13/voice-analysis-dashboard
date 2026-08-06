import type {
  AudioQuality,
  BatchState,
  BatchStatus,
  EmotionalIntensity,
  EmotionalTone,
  FileResult,
  NoiseSeverity,
  Prediction,
} from "./types";

interface MockBatchInternal {
  batch_id: string;
  status: BatchStatus;
  files: FileResult[];
}

const TONES: EmotionalTone[] = ["neutral", "satisfied", "frustrated", "upset", "distressed"];
const INTENSITIES: EmotionalIntensity[] = ["low", "medium", "high"];
const NOISE_SEVERITIES: NoiseSeverity[] = ["low", "medium", "high"];
const QUALITIES: AudioQuality[] = ["clear", "slightly_impaired", "severely_impaired"];
const NOISE_TYPES = ["traffic", "hvac hum", "crosstalk", "line static", "background music", "office chatter"];

const batches = new Map<string, MockBatchInternal>();

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPrediction(): Prediction {
  const noisePresent = Math.random() < 0.5;
  return {
    emotional_tone: pick(TONES),
    emotional_intensity: pick(INTENSITIES),
    background_noise_present: noisePresent,
    background_noise_type: noisePresent ? pick(NOISE_TYPES) : "",
    background_noise_severity: noisePresent ? pick(NOISE_SEVERITIES) : "none",
    audio_quality: pick(QUALITIES),
    speaker_overlap_present: Math.random() < 0.3,
    long_silence_present: Math.random() < 0.25,
    confidence: Math.round((0.55 + Math.random() * 0.45) * 100) / 100,
  };
}

function makeId(): string {
  return `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function mockSubmitBatch(fileNames: string[]): { batch_id: string; status: BatchStatus; total_files: number } {
  const id = makeId();
  const files: FileResult[] = fileNames.map((name) => ({
    name,
    status: "pending",
    prediction: null,
    error: null,
    processing_ms: null,
  }));
  const status: BatchStatus = fileNames.length === 0 ? "completed" : "queued";
  batches.set(id, { batch_id: id, status, files });

  if (fileNames.length > 0) {
    const failIndex = Math.floor(Math.random() * fileNames.length);
    runMockProcessing(id, failIndex);
  }

  return { batch_id: id, status, total_files: fileNames.length };
}

function runMockProcessing(id: string, failIndex: number) {
  const batch = batches.get(id);
  if (!batch) return;
  batch.status = "running";
  let i = 0;

  const step = () => {
    const current = batches.get(id);
    if (!current) return;

    if (i > 0) {
      const prevFile = current.files[i - 1];
      if (i - 1 === failIndex) {
        prevFile.status = "failed";
        prevFile.error = { code: "DECODE_FAILED", message: "Unsupported or corrupt audio stream" };
        prevFile.processing_ms = Math.round(200 + Math.random() * 800);
      } else {
        prevFile.status = "succeeded";
        prevFile.prediction = randomPrediction();
        prevFile.processing_ms = Math.round(400 + Math.random() * 2600);
      }
    }

    if (i < current.files.length) {
      current.files[i].status = "processing";
      i += 1;
      setTimeout(step, 700);
    } else {
      current.status = "completed";
    }
  };

  setTimeout(step, 700);
}

export function mockGetBatch(batchId: string): BatchState {
  const batch = batches.get(batchId);
  if (!batch) {
    throw new Error(`Unknown batch: ${batchId}`);
  }
  const completed = batch.files.filter((f) => f.status === "succeeded" || f.status === "failed").length;
  const failed = batch.files.filter((f) => f.status === "failed").length;
  return {
    batch_id: batch.batch_id,
    status: batch.status,
    counts: { total: batch.files.length, completed, failed },
    results: batch.files.map((f) => ({
      ...f,
      prediction: f.prediction ? { ...f.prediction } : null,
      error: f.error ? { ...f.error } : null,
    })),
  };
}
