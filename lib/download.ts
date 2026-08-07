import type { PredictionSource } from "./scoring";
import type { FileResult, PipelineMode } from "./types";

const CSV_COLUMNS = [
  "name",
  "status",
  "emotional_tone",
  "emotional_intensity",
  "background_noise_present",
  "background_noise_type",
  "background_noise_severity",
  "audio_quality",
  "speaker_overlap_present",
  "long_silence_present",
  "confidence",
  "error_code",
  "error_message",
] as const;

type CsvRow = Record<(typeof CSV_COLUMNS)[number], string>;

function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function resultsToCsv(results: FileResult[], source: PredictionSource = "prediction"): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of results) {
    const p = r[source] ?? null;
    const row: CsvRow = {
      name: r.name,
      status: r.status,
      emotional_tone: p?.emotional_tone ?? "",
      emotional_intensity: p?.emotional_intensity ?? "",
      background_noise_present: p ? String(p.background_noise_present) : "",
      background_noise_type: p?.background_noise_type ?? "",
      background_noise_severity: p?.background_noise_severity ?? "",
      audio_quality: p?.audio_quality ?? "",
      speaker_overlap_present: p ? String(p.speaker_overlap_present) : "",
      long_silence_present: p ? String(p.long_silence_present) : "",
      confidence: p ? String(p.confidence) : "",
      error_code: r.error?.code ?? "",
      error_message: r.error?.message ?? "",
    };
    lines.push(CSV_COLUMNS.map((c) => csvField(row[c])).join(","));
  }
  return lines.join("\r\n");
}

export function resultsToJson(results: FileResult[], source: PredictionSource = "prediction"): string {
  return JSON.stringify(
    results.map((r) => ({ name: r.name, status: r.status, result: r[source] ?? null, error: r.error })),
    null,
    2
  );
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// In "both" mode each pipeline gets its own file — a single export keyed on
// `prediction` would silently ship hybrid only, since the backend sets
// primary=hybrid whenever both ran. Chrome throttles back-to-back programmatic
// downloads, so the second is nudged past the first rather than fired in the
// same tick.
const SECOND_DOWNLOAD_DELAY_MS = 400;

function downloadPerPipeline(
  results: FileResult[],
  batchId: string,
  pipelineMode: PipelineMode,
  ext: "csv" | "json",
  mime: string,
  render: (results: FileResult[], source: PredictionSource) => string
) {
  if (pipelineMode !== "both") {
    downloadBlob(render(results, "prediction"), mime, `results_${batchId}.${ext}`);
    return;
  }

  downloadBlob(render(results, "hybrid_prediction"), mime, `results_${batchId}_hybrid.${ext}`);
  setTimeout(() => {
    downloadBlob(render(results, "llm_full_prediction"), mime, `results_${batchId}_llm_full.${ext}`);
  }, SECOND_DOWNLOAD_DELAY_MS);
}

export function downloadResultsCsv(results: FileResult[], batchId: string, pipelineMode: PipelineMode = "hybrid") {
  downloadPerPipeline(results, batchId, pipelineMode, "csv", "text/csv;charset=utf-8", resultsToCsv);
}

export function downloadResultsJson(results: FileResult[], batchId: string, pipelineMode: PipelineMode = "hybrid") {
  downloadPerPipeline(results, batchId, pipelineMode, "json", "application/json", resultsToJson);
}
