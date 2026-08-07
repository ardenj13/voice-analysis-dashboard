import type { BatchState, ConfigOptions } from "./types";
import { mockGetBatch, mockGetConfigOptions, mockLogin, mockSubmitBatch } from "./mock";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const TOKEN_KEY = "authToken";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    sessionStorage.removeItem(TOKEN_KEY);
    window.location.reload();
  }
  return res;
}

export async function login(username: string, password: string): Promise<void> {
  if (USE_MOCK) {
    sessionStorage.setItem(TOKEN_KEY, mockLogin());
    return;
  }

  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? "Invalid username or password." : `Login failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const token = data.token ?? data.access_token;
  if (!token) {
    throw new Error("Login response did not include a token.");
  }
  sessionStorage.setItem(TOKEN_KEY, token);
}

export interface SubmitFile {
  name: string;
  blob: Blob;
}

export interface SubmitBatchParams {
  mode: "zip" | "folder";
  archiveFile?: File;
  files: SubmitFile[];
  manifestCsvText?: string | null;
  pipelineMode: string;
  geminiModel: string;
}

export interface SubmitBatchResponse {
  batch_id: string;
  status: BatchState["status"];
  total_files: number;
}

export async function getConfigOptions(): Promise<ConfigOptions> {
  if (USE_MOCK) {
    return mockGetConfigOptions();
  }

  const res = await apiFetch("/v1/config/options");
  if (!res.ok) {
    throw new Error(`Fetch config options failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function submitBatch(params: SubmitBatchParams): Promise<SubmitBatchResponse> {
  if (USE_MOCK) {
    return mockSubmitBatch(
      params.files.map((f) => f.name),
      params.pipelineMode,
      params.geminiModel
    );
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
  formData.append("pipeline_mode", params.pipelineMode);
  formData.append("gemini_model", params.geminiModel);

  const res = await apiFetch("/v1/batches", { method: "POST", body: formData });
  if (!res.ok) {
    throw new Error(`Submit failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getBatch(batchId: string): Promise<BatchState> {
  if (USE_MOCK) {
    return mockGetBatch(batchId);
  }

  const res = await apiFetch(`/v1/batches/${batchId}`);
  if (!res.ok) {
    throw new Error(`Fetch batch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
