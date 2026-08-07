"use client";

import type { BatchState, PipelineMode } from "@/lib/types";
import { buildLatencyReport, seconds, type LatencyLeg } from "@/lib/cost";

const TOP_STAGES = 4;

export default function LatencyPanel({
  batch,
  pipelineMode,
  fallbackBytes,
}: {
  batch: BatchState;
  pipelineMode: PipelineMode;
  fallbackBytes: number;
}) {
  const report = buildLatencyReport(batch, pipelineMode, fallbackBytes);
  if (!report) return null;

  const both = report.legs.length > 1;

  return (
    <section className="border border-[var(--border)] rounded-[4px] p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Latency</h2>
        {both ? null : <Rtf leg={report.legs[0]} />}
      </div>

      <div className={`grid gap-6 ${both ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
        {report.legs.map((leg) => (
          <div key={leg.id} className="flex flex-col gap-3">
            {both ? (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[13px]">{leg.label}</span>
                <Rtf leg={leg} />
              </div>
            ) : null}

            <dl className="text-[14px]">
              <Row label={`Per clip (p50, n=${leg.clipCount})`}>{seconds(leg.p50Ms)}</Row>
              <Row label="Per clip (p95)">{seconds(leg.p95Ms)}</Row>
              <Row label="Per audio-minute">{seconds(leg.msPerAudioMinute)}</Row>
            </dl>

            <div className="flex flex-col gap-2">
              <h3 className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Slowest stages</h3>
              {leg.stages.length === 0 ? (
                <p className="text-[13px] text-[var(--text-muted)]">
                  One Gemini call, no local stages — nothing to break down.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {leg.stages.slice(0, TOP_STAGES).map((s) => (
                    <li key={s.stage} className="grid grid-cols-[80px_minmax(0,1fr)_40px] items-center gap-3">
                      <span className="font-mono text-[13px] truncate">{s.stage}</span>
                      <span className="h-[4px] w-full bg-[var(--border)]">
                        <span className="block h-full bg-[var(--text)]" style={{ width: `${s.pct * 100}%` }} />
                      </span>
                      <span className="font-mono text-[13px] text-right">{(s.pct * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
        Wall time measured per file. RTF is compute-seconds per second of audio. Stage shares are summed across the
        batch and run sequentially today, so the largest share is also the largest parallelisation opportunity.
      </p>
    </section>
  );
}

function Rtf({ leg }: { leg: LatencyLeg }) {
  return (
    <span className="font-mono text-[18px] tracking-tight">
      <span className="text-[var(--text-muted)]">RTF</span> {leg.rtf.toFixed(2)}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-2 border-b border-[var(--border)] last:border-b-0">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="font-mono text-right whitespace-nowrap">{children}</dd>
    </div>
  );
}
