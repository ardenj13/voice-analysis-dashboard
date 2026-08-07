import type { ExtractedBatch, ExtractedFile } from "./archive";
import type { ParsedManifest } from "./manifest";
import type { ManifestRow } from "./types";

export interface LedgerEntry {
  filename: string;
  reason: string;
}

export interface ProcessFile {
  name: string;
  size: number;
  getBlob: () => Promise<Blob>;
}

export interface LedgerGroups {
  matched: LedgerEntry[];
  missingAudio: LedgerEntry[];
  unmatchedFiles: LedgerEntry[];
  unsupported: LedgerEntry[];
  duplicates: LedgerEntry[];
  manifestErrors: LedgerEntry[];
}

export interface LedgerModel {
  counts: {
    matched: number;
    missingAudio: number;
    unmatchedFiles: number;
    unsupported: number;
    duplicates: number;
    manifestErrors: number;
  };
  groups: LedgerGroups;
  warnings: string[];
  totalDecompressedSize: number;
  sizeWarningBytes: number;
  blockingReason: string | null;
  toProcess: ProcessFile[];
  skippedFileCount: number;
  hasManifest: boolean;
}

const SIZE_LIMIT_BYTES = 200 * 1024 * 1024;

function emptyLedger(blockingReason: string | null): LedgerModel {
  return {
    counts: { matched: 0, missingAudio: 0, unmatchedFiles: 0, unsupported: 0, duplicates: 0, manifestErrors: 0 },
    groups: { matched: [], missingAudio: [], unmatchedFiles: [], unsupported: [], duplicates: [], manifestErrors: [] },
    warnings: [],
    totalDecompressedSize: 0,
    sizeWarningBytes: 0,
    blockingReason,
    toProcess: [],
    skippedFileCount: 0,
    hasManifest: false,
  };
}

export function buildLedger(batch: ExtractedBatch, manifest: ParsedManifest): LedgerModel {
  if (batch.openError) {
    return emptyLedger(batch.openError);
  }

  const matched: LedgerEntry[] = [];
  const missingAudio: LedgerEntry[] = [];
  const unmatchedFiles: LedgerEntry[] = [];
  const unsupported: LedgerEntry[] = [];
  const duplicates: LedgerEntry[] = [];
  const manifestErrors: LedgerEntry[] = [];
  const warnings: string[] = [];
  let duplicateFileCount = 0;

  const audioByName = new Map<string, ExtractedFile>();
  for (const f of batch.audioFiles) {
    if (audioByName.has(f.basename)) {
      duplicates.push({ filename: f.basename, reason: `duplicate file — first occurrence used (also found at "${f.path}")` });
      duplicateFileCount += 1;
    } else {
      audioByName.set(f.basename, f);
    }
  }

  const rowsByName = new Map<string, ManifestRow>();
  for (const row of manifest.rows) {
    if (rowsByName.has(row.name)) {
      duplicates.push({ filename: row.name, reason: "duplicate manifest row — first occurrence used" });
    } else {
      rowsByName.set(row.name, row);
    }
  }

  const lowerAudioIndex = new Map<string, string[]>();
  for (const basename of audioByName.keys()) {
    const lower = basename.toLowerCase();
    const list = lowerAudioIndex.get(lower) ?? [];
    list.push(basename);
    lowerAudioIndex.set(lower, list);
  }

  const consumed = new Set<string>();

  for (const row of rowsByName.values()) {
    if (audioByName.has(row.name)) {
      matched.push({ filename: row.name, reason: "" });
      consumed.add(row.name);
    } else {
      const candidates = (lowerAudioIndex.get(row.name.toLowerCase()) ?? []).filter((c) => c !== row.name);
      if (candidates.length > 0) {
        missingAudio.push({ filename: row.name, reason: "missing audio (case mismatch — see warning)" });
        warnings.push(`case mismatch: manifest has "${row.name}", archive has "${candidates[0]}"`);
      } else {
        missingAudio.push({ filename: row.name, reason: "no matching audio file" });
      }
    }

    if (row.parseError) {
      manifestErrors.push({ filename: row.name, reason: `result_json did not parse: ${row.parseError}` });
    }
  }

  for (const [basename, file] of audioByName.entries()) {
    if (!consumed.has(basename)) {
      unmatchedFiles.push({ filename: basename, reason: "no manifest row — will still be processed" });
    }
    if (file.flattened) {
      warnings.push(`flattened: "${file.path}" was nested and matched by filename only`);
    }
  }

  for (const file of batch.unsupportedFiles) {
    unsupported.push({ filename: file.basename, reason: `unsupported extension "${file.ext || "(none)"}"` });
  }

  for (const file of batch.csvFiles) {
    if (file.flattened) {
      warnings.push(`flattened: "${file.path}" was nested and matched by filename only`);
    }
  }

  const toProcess: ProcessFile[] = Array.from(audioByName.values()).map((f) => ({
    name: f.basename,
    size: f.size,
    getBlob: f.getBlob,
  }));

  const blockingReason = toProcess.length === 0 ? "No supported audio files were found in this batch." : null;

  return {
    counts: {
      matched: matched.length,
      missingAudio: missingAudio.length,
      unmatchedFiles: unmatchedFiles.length,
      unsupported: unsupported.length,
      duplicates: duplicates.length,
      manifestErrors: manifestErrors.length,
    },
    groups: { matched, missingAudio, unmatchedFiles, unsupported, duplicates, manifestErrors },
    warnings,
    totalDecompressedSize: batch.totalDecompressedSize,
    sizeWarningBytes: batch.totalDecompressedSize > SIZE_LIMIT_BYTES ? batch.totalDecompressedSize : 0,
    blockingReason,
    toProcess,
    skippedFileCount: unsupported.length + duplicateFileCount,
    hasManifest: manifest.hasNameColumn,
  };
}
