"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DropZone from "@/components/DropZone";
import LoginScreen from "@/components/LoginScreen";
import PreflightLedger from "@/components/PreflightLedger";
import ProgressHeader from "@/components/ProgressHeader";
import ResultsTable from "@/components/ResultsTable";
import ResultDrawer from "@/components/ResultDrawer";
import ScoringPanel from "@/components/ScoringPanel";
import { extractDataTransfer, extractFileList, extractZip, type ExtractedBatch } from "@/lib/archive";
import { parseManifest, type ParsedManifest } from "@/lib/manifest";
import { buildLedger, type LedgerModel } from "@/lib/validate";
import { getBatch, getConfigOptions, isAuthenticated, submitBatch } from "@/lib/api";
import { downloadResultsCsv, downloadResultsJson } from "@/lib/download";
import type { BatchState, ConfigOptions, FileResult, PipelineMode } from "@/lib/types";
import { modelLabel, pipelineShortLabel } from "@/components/RunSettings";

type View = "empty" | "ledger" | "running" | "complete";

const POLL_FAST_MS = 1500;
const POLL_SLOW_MS = 5000;
const POLL_SLOW_AFTER_MS = 60 * 1000;
const POLL_CAP_MS = 30 * 60 * 1000;

export default function Page() {
  const [view, setView] = useState<View>("empty");
  const [sourceMode, setSourceMode] = useState<"zip" | "folder" | null>(null);
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [manifest, setManifest] = useState<ParsedManifest>({ rows: [], hasNameColumn: false, hasResultJsonColumn: false });
  const [manifestCsvText, setManifestCsvText] = useState<string | null>(null);
  const [ledger, setLedger] = useState<LedgerModel | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [batchState, setBatchState] = useState<BatchState | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [selectedResult, setSelectedResult] = useState<FileResult | null>(null);

  const [configOptions, setConfigOptions] = useState<ConfigOptions | null>(null);
  const [selectedPipelineMode, setSelectedPipelineMode] = useState("");
  const [selectedGeminiModel, setSelectedGeminiModel] = useState("");

  const [authed, setAuthed] = useState<boolean | null>(null);

  const batchIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStoppedRef = useRef(true);
  const pollStartRef = useRef(0);
  const failCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    pollStoppedRef.current = true;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const schedulePollRef = useRef<(id: string, delay: number) => void>(() => {});

  const schedulePoll = useCallback((id: string, delay: number) => {
    if (pollStoppedRef.current) return;
    pollTimerRef.current = setTimeout(async () => {
      if (pollStoppedRef.current) return;

      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed > POLL_CAP_MS) {
        pollStoppedRef.current = true;
        setShowResume(true);
        return;
      }

      let state: BatchState | null = null;
      try {
        state = await getBatch(id);
        failCountRef.current = 0;
        setReconnecting(false);
        setBatchState(state);
      } catch {
        failCountRef.current += 1;
        if (failCountRef.current >= 3) setReconnecting(true);
      }

      if (pollStoppedRef.current) return;

      if (state && (state.status === "completed" || state.status === "failed")) {
        pollStoppedRef.current = true;
        setView("complete");
        return;
      }

      const nextDelay = failCountRef.current > 0 ? POLL_SLOW_MS : elapsed > POLL_SLOW_AFTER_MS ? POLL_SLOW_MS : POLL_FAST_MS;
      schedulePollRef.current(id, nextDelay);
    }, delay);
  }, []);

  useEffect(() => {
    schedulePollRef.current = schedulePoll;
  }, [schedulePoll]);

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  useEffect(() => {
    getConfigOptions()
      .then((opts) => {
        setConfigOptions(opts);
        setSelectedPipelineMode(opts.default_pipeline_mode);
        setSelectedGeminiModel(opts.default_model);
      })
      .catch(() => {
        // Run settings section stays hidden; submission falls back to empty selections.
      });
  }, []);

  const resetAll = useCallback(() => {
    stopPolling();
    setView("empty");
    setSourceMode(null);
    setArchiveFile(null);
    setManifest({ rows: [], hasNameColumn: false, hasResultJsonColumn: false });
    setManifestCsvText(null);
    setLedger(null);
    setSubmitting(false);
    setSubmitError(null);
    batchIdRef.current = null;
    setBatchState(null);
    setCancelled(false);
    setReconnecting(false);
    setShowResume(false);
    setSelectedResult(null);
    failCountRef.current = 0;
  }, [stopPolling]);

  const afterExtract = useCallback(async (batch: ExtractedBatch) => {
    let manifestText: string | null = null;
    let parsed: ParsedManifest = { rows: [], hasNameColumn: false, hasResultJsonColumn: false };

    if (!batch.openError && batch.csvFiles.length > 0) {
      const blob = await batch.csvFiles[0].getBlob();
      manifestText = await blob.text();
      parsed = parseManifest(manifestText);
    }

    setManifestCsvText(manifestText);
    setManifest(parsed);
    setLedger(buildLedger(batch, parsed));
    setView("ledger");
  }, []);

  const handleZip = useCallback(
    async (file: File) => {
      setSourceMode("zip");
      setArchiveFile(file);
      const batch = await extractZip(file);
      await afterExtract(batch);
    },
    [afterExtract]
  );

  const handleFolder = useCallback(
    async (files: FileList) => {
      setSourceMode("folder");
      setArchiveFile(null);
      const batch = await extractFileList(files);
      await afterExtract(batch);
    },
    [afterExtract]
  );

  const handleDataTransferDrop = useCallback(
    async (dataTransfer: DataTransfer) => {
      const outcome = await extractDataTransfer(dataTransfer);
      if (outcome.kind === "zip") {
        setSourceMode("zip");
        setArchiveFile(outcome.file);
        const batch = await extractZip(outcome.file);
        await afterExtract(batch);
      } else {
        setSourceMode("folder");
        setArchiveFile(null);
        await afterExtract(outcome.batch);
      }
    },
    [afterExtract]
  );

  const handleRun = useCallback(async () => {
    if (!ledger) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const files = await Promise.all(
        ledger.toProcess.map(async (f) => ({ name: f.name, blob: await f.getBlob() }))
      );
      const res = await submitBatch({
        mode: sourceMode === "zip" ? "zip" : "folder",
        archiveFile: archiveFile ?? undefined,
        files,
        manifestCsvText,
        pipelineMode: selectedPipelineMode,
        geminiModel: selectedGeminiModel,
      });

      batchIdRef.current = res.batch_id;
      setCancelled(false);
      setShowResume(false);
      setReconnecting(false);
      failCountRef.current = 0;
      pollStoppedRef.current = false;
      pollStartRef.current = Date.now();
      setView("running");

      try {
        const state = await getBatch(res.batch_id);
        setBatchState(state);
        if (state.status === "completed" || state.status === "failed") {
          pollStoppedRef.current = true;
          setView("complete");
          return;
        }
      } catch {
        failCountRef.current += 1;
      }

      schedulePoll(res.batch_id, POLL_FAST_MS);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }, [ledger, sourceMode, archiveFile, manifestCsvText, selectedPipelineMode, selectedGeminiModel, schedulePoll]);

  const handleCancel = useCallback(() => {
    stopPolling();
    setCancelled(true);
  }, [stopPolling]);

  const handleResume = useCallback(() => {
    if (!batchIdRef.current) return;
    setShowResume(false);
    pollStoppedRef.current = false;
    pollStartRef.current = Date.now();
    failCountRef.current = 0;
    schedulePoll(batchIdRef.current, POLL_FAST_MS);
  }, [schedulePoll]);

  const results = batchState?.files ?? [];
  const hasLabels = manifest.rows.some((r) => r.expected !== null);
  const activePipelineMode = (batchState?.pipeline_mode as PipelineMode | undefined) ?? "hybrid";

  if (authed === null) {
    return null;
  }

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />;
  }

  return (
    <main className="max-w-[1200px] mx-auto px-8 py-12 flex flex-col gap-8">
      <header className="flex flex-col gap-1.5 pb-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-[28px] h-[28px] rounded-[4px] bg-[var(--text)] flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="0" y="5" width="2" height="4" fill="#ffffff" />
              <rect x="3.5" y="2" width="2" height="10" fill="#ffffff" />
              <rect x="7" y="0" width="2" height="14" fill="#ffffff" />
              <rect x="10.5" y="3" width="2" height="8" fill="#ffffff" />
            </svg>
          </div>
          <h1 className="text-[24px] font-medium tracking-tight">Audio Analysis Batch Console</h1>
        </div>
        <p className="text-[13px] text-[var(--text-muted)] pl-[40px]">
          Upload a batch of call recordings, run analysis, and review structured results.
        </p>
      </header>

      {view === "empty" ? (
        <div className="flex flex-col gap-6">
          <DropZone onZip={handleZip} onFolder={handleFolder} onDrop={handleDataTransferDrop} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--border)] border border-[var(--border)] rounded-[4px] overflow-hidden">
            <InfoCell label="Archive" value="A .zip file, or a folder. A single wrapping folder is detected automatically." />
            <InfoCell label="Manifest" value="One CSV at the batch root with name and result_json columns." />
            <InfoCell label="Size guard" value="Batches over 200 MB show a warning but are never blocked." />
          </div>
        </div>
      ) : null}

      {view === "ledger" && ledger ? (
        <>
          {submitError ? <p className="text-[14px] text-[var(--err)]">Submit failed: {submitError}</p> : null}
          <PreflightLedger
            ledger={ledger}
            onRun={handleRun}
            onClear={resetAll}
            submitting={submitting}
            configOptions={configOptions}
            pipelineMode={selectedPipelineMode}
            onPipelineModeChange={setSelectedPipelineMode}
            geminiModel={selectedGeminiModel}
            onModelChange={setSelectedGeminiModel}
          />
        </>
      ) : null}

      {(view === "running" || view === "complete") && ledger ? (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)] font-mono">
              {ledger.toProcess.length} files submitted for analysis
            </p>
            {batchState ? (
              <p className="text-[12px] text-[var(--text-muted)] font-mono">
                {pipelineShortLabel(batchState.pipeline_mode)} · {modelLabel(configOptions, batchState.gemini_model)}
              </p>
            ) : null}
          </div>

          {view === "running" && batchState ? (
            <ProgressHeader
              total={batchState.counts.total}
              completed={batchState.counts.completed}
              failed={batchState.counts.failed}
              cancelled={cancelled}
              reconnecting={reconnecting}
              onCancel={handleCancel}
              onResume={handleResume}
              showResume={showResume}
            />
          ) : null}

          {view === "complete" && batchState?.status === "failed" ? (
            <p className="text-[14px] text-[var(--err)]">Batch failed: {batchState.error ?? "Unknown error"}</p>
          ) : null}

          {view === "complete" && batchState ? (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => downloadResultsCsv(results, batchState.batch_id)}
                disabled={results.every((r) => r.status !== "succeeded" && r.status !== "failed")}
              >
                Download CSV
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => downloadResultsJson(results, batchState.batch_id)}
                disabled={results.every((r) => r.status !== "succeeded" && r.status !== "failed")}
              >
                Download JSON
              </button>
              <button type="button" className="btn-secondary" onClick={resetAll}>
                Clear batch
              </button>
            </div>
          ) : null}

          {view === "complete" ? (
            <ScoringPanel results={results} manifestRows={manifest.rows} pipelineMode={activePipelineMode} />
          ) : null}

          <ResultsTable
            results={results}
            manifestRows={manifest.rows}
            hasLabels={hasLabels}
            pipelineMode={activePipelineMode}
            onSelect={setSelectedResult}
          />
        </div>
      ) : null}

      <ResultDrawer
        key={selectedResult?.name ?? "none"}
        result={selectedResult}
        expected={
          selectedResult ? manifest.rows.find((r) => r.name === selectedResult.name)?.expected ?? null : null
        }
        onClose={() => setSelectedResult(null)}
      />
    </main>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--surface)] px-4 py-3 flex flex-col gap-1.5">
      <span className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</span>
      <span className="text-[13px] text-[var(--text)] leading-snug">{value}</span>
    </div>
  );
}
