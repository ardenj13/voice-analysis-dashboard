import type { BatchState } from "./types";
import { mockGetBatch, mockSubmitBatch } from "./mock";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export interface SubmitFile {
  name: string;
  blob: Blob;
}

export interface SubmitBatchParams {
  mode: "zip" | "folder";
  archiveFile?: File;
  files: SubmitFile[];
  manifestCsvText?: string | null;
}

export interface SubmitBatchResponse {
  batch_id: string;
  status: BatchState["status"];
  total_files: number;
}

export async function submitBatch(params: SubmitBatchParams): Promise<SubmitBatchResponse> {
  if (USE_MOCK) {
    return mockSubmitBatch(params.files.map((f) => f.name));
  }

  const formData = new FormData();
  if (params.mode === "zip" && params.archiveFile) {
    formData.append("archive", params.archiveFile);
  } else {
    for (const f of params.files) {
      formData.append("audio", f.blob, f.name);
    }
    if (params.manifestCsvText) {
      formData.append("manifest", new Blob([params.manifestCsvText], { type: "text/csv" }), "manifest.csv");
    }
  }

  const res = await fetch(`${API_BASE}/v1/batches`, { method: "POST", body: formData });
  if (!res.ok) {
    throw new Error(`Submit failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getBatch(batchId: string): Promise<BatchState> {
  if (USE_MOCK) {
    return mockGetBatch(batchId);
  }

  const res = await fetch(`${API_BASE}/v1/batches/${batchId}`);
  if (!res.ok) {
    throw new Error(`Fetch batch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
