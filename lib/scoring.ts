import type { EmotionalTone, FileResult, ManifestRow, Prediction } from "./types";

export const TONES: EmotionalTone[] = ["neutral", "satisfied", "frustrated", "upset", "distressed"];

export const SCORED_FIELDS: (keyof Prediction)[] = [
  "emotional_tone",
  "emotional_intensity",
  "background_noise_present",
  "background_noise_type",
  "background_noise_severity",
  "audio_quality",
  "speaker_overlap_present",
  "long_silence_present",
];

export interface FieldAccuracy {
  field: string;
  correct: number;
  total: number;
  pct: number;
}

export interface ClassMetric {
  label: EmotionalTone;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface ScoringResult {
  scoredCount: number;
  totalWithResults: number;
  fieldAccuracy: FieldAccuracy[];
  confidenceMae: number;
  macroF1: number;
  classMetrics: ClassMetric[];
  confusionMatrix: number[][]; // [actual][predicted]
  toneLabels: EmotionalTone[];
}

export function computeScoring(results: FileResult[], manifestRows: ManifestRow[]): ScoringResult | null {
  const expectedByName = new Map<string, Prediction>();
  for (const row of manifestRows) {
    if (row.expected) expectedByName.set(row.name, row.expected);
  }

  if (expectedByName.size === 0) return null;

  const totalWithResults = results.length;
  const scored = results.filter(
    (r) => r.status === "succeeded" && r.prediction && expectedByName.has(r.name)
  );

  const fieldAccuracy: FieldAccuracy[] = SCORED_FIELDS.map((field) => {
    let correct = 0;
    for (const r of scored) {
      const expected = expectedByName.get(r.name)!;
      if (expected[field] === r.prediction![field]) correct++;
    }
    return { field, correct, total: scored.length, pct: scored.length ? correct / scored.length : 0 };
  });

  let confidenceErrSum = 0;
  for (const r of scored) {
    const expected = expectedByName.get(r.name)!;
    const allCorrect = SCORED_FIELDS.every((f) => expected[f] === r.prediction![f]);
    confidenceErrSum += Math.abs(r.prediction!.confidence - (allCorrect ? 1 : 0));
  }
  const confidenceMae = scored.length ? confidenceErrSum / scored.length : 0;

  const matrix: number[][] = TONES.map(() => TONES.map(() => 0));
  for (const r of scored) {
    const expected = expectedByName.get(r.name)!;
    const ai = TONES.indexOf(expected.emotional_tone);
    const pi = TONES.indexOf(r.prediction!.emotional_tone);
    if (ai >= 0 && pi >= 0) matrix[ai][pi]++;
  }

  const classMetrics: ClassMetric[] = TONES.map((tone, i) => {
    const tp = matrix[i][i];
    const predictedTotal = matrix.reduce((sum, row) => sum + row[i], 0);
    const actualTotal = matrix[i].reduce((a, b) => a + b, 0);
    const precision = predictedTotal ? tp / predictedTotal : 0;
    const recall = actualTotal ? tp / actualTotal : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { label: tone, precision, recall, f1, support: actualTotal };
  });

  const macroF1 = classMetrics.reduce((sum, c) => sum + c.f1, 0) / classMetrics.length;

  return {
    scoredCount: scored.length,
    totalWithResults,
    fieldAccuracy,
    confidenceMae,
    macroF1,
    classMetrics,
    confusionMatrix: matrix,
    toneLabels: TONES,
  };
}
