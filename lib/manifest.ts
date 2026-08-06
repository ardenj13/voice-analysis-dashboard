import Papa from "papaparse";
import type { ManifestRow, Prediction } from "./types";

export interface ParsedManifest {
  rows: ManifestRow[];
  hasNameColumn: boolean;
  hasResultJsonColumn: boolean;
}

export function parseManifest(csvText: string): ParsedManifest {
  const text = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText;

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    quoteChar: '"',
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const fields = parsed.meta.fields ?? [];
  const hasNameColumn = fields.includes("name");
  const hasResultJsonColumn = fields.includes("result_json");

  if (!hasNameColumn) {
    return { rows: [], hasNameColumn: false, hasResultJsonColumn };
  }

  const rows: ManifestRow[] = [];
  for (const record of parsed.data) {
    const name = (record["name"] ?? "").trim();
    if (!name) continue;

    const rawResultJson = (record["result_json"] ?? "").trim();
    if (!rawResultJson) {
      rows.push({ name, expected: null, rawResultJson: "" });
      continue;
    }

    try {
      const expected = JSON.parse(rawResultJson) as Prediction;
      rows.push({ name, expected, rawResultJson });
    } catch (e) {
      rows.push({ name, expected: null, rawResultJson, parseError: (e as Error).message });
    }
  }

  return { rows, hasNameColumn, hasResultJsonColumn };
}
