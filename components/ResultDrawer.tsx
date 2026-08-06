"use client";

import { useEffect, useState } from "react";
import type { FileResult, Prediction } from "@/lib/types";

const FIELD_ORDER: (keyof Prediction)[] = [
  "emotional_tone",
  "emotional_intensity",
  "background_noise_present",
  "background_noise_type",
  "background_noise_severity",
  "audio_quality",
  "speaker_overlap_present",
  "long_silence_present",
  "confidence",
];

export default function ResultDrawer({
  result,
  expected,
  onClose,
}: {
  result: FileResult | null;
  expected: Prediction | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, onClose]);

  if (!result) return null;

  const json = JSON.stringify(result.prediction, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
  };

  return (
    <div
      className="fixed top-0 right-0 z-10 h-full w-full sm:w-[480px] bg-white border-l border-[var(--border)] flex flex-col motion-reduce:transition-none"
      role="dialog"
      aria-label={`Result detail for ${result.name}`}
    >
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[var(--border)]">
        <h2 className="text-[16px] font-medium tracking-tight font-mono truncate">{result.name}</h2>
        <button type="button" className="btn-secondary" onClick={onClose} aria-label="Close">
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
        {result.status === "failed" ? (
          <p className="text-[14px] text-[var(--err)] font-mono">
            {result.error?.code}: {result.error?.message}
          </p>
        ) : null}

        {result.prediction ? (
          <div className="flex flex-col gap-2">
            {expected ? (
              <div
                className="grid gap-x-3 text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]"
                style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
              >
                <span>Field</span>
                <span>Predicted</span>
                <span>Expected</span>
              </div>
            ) : null}
            <div className="bg-[var(--surface-sunken)] rounded-[4px] p-3 flex flex-col gap-1 font-mono text-[13px]">
              {FIELD_ORDER.map((field) => {
                const predictedVal = result.prediction![field];
                const expectedVal = expected ? expected[field] : undefined;
                const differs = !!expected && predictedVal !== expectedVal;
                return (
                  <div
                    key={field}
                    className="grid gap-x-3 py-1 px-2"
                    style={{
                      gridTemplateColumns: expected ? "1fr 1fr 1fr" : "1fr 1fr",
                      boxShadow: differs ? "inset 2px 0 0 var(--warn)" : undefined,
                    }}
                  >
                    <span className="text-[var(--text-muted)]">{field}</span>
                    <span className="text-[var(--text)]">{JSON.stringify(predictedVal)}</span>
                    {expected ? (
                      <span className={differs ? "text-[var(--warn)]" : "text-[var(--text)]"}>
                        {JSON.stringify(expectedVal)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div>
          <button type="button" className="btn-secondary" onClick={handleCopy}>
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
      </div>
    </div>
  );
}
