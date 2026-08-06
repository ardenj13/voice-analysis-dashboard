import type { FileResult } from "./types";

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

export function resultsToCsv(results: FileResult[]): string {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of results) {
    const p = r.prediction;
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

export function resultsToJson(results: FileResult[]): string {
  return JSON.stringify(
    results.map((r) => ({ name: r.name, status: r.status, result: r.prediction, error: r.error })),
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

export function downloadResultsCsv(results: FileResult[], batchId: string) {
  downloadBlob(resultsToCsv(results), "text/csv;charset=utf-8", `results_${batchId}.csv`);
}

export function downloadResultsJson(results: FileResult[], batchId: string) {
  downloadBlob(resultsToJson(results), "application/json", `results_${batchId}.json`);
}
