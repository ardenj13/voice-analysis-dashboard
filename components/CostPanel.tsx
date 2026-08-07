"use client";

import type { BatchState, ConfigOptions, PipelineMode } from "@/lib/types";
import { buildCostReport, tokens, usd, type CostLeg } from "@/lib/cost";

// Above this share of the ceiling the bar turns --warn: still under, but not
// by enough margin to be comfortable.
const WARN_AT_CEILING_RATIO = 0.8;

export default function CostPanel({
  batch,
  pipelineMode,
  configOptions,
  fallbackBytes,
}: {
  batch: BatchState;
  pipelineMode: PipelineMode;
  configOptions: ConfigOptions | null;
  fallbackBytes: number;
}) {
  const ceiling = configOptions?.cost_ceiling_per_min ?? 0.003;
  const fallbackUsdPerMin =
    configOptions?.models.find((m) => m.id === batch.gemini_model)?.estimated_cost_per_min ?? 0;

  const report = buildCostReport(batch, pipelineMode, ceiling, fallbackBytes, fallbackUsdPerMin);
  if (!report) return null;

  const both = report.legs.length > 1;

  return (
    <section className="border border-[var(--border)] rounded-[4px] p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Cost</h2>
        {both ? null : <Headline leg={report.legs[0]} ceiling={ceiling} />}
      </div>

      {both ? null : <CeilingBar ratio={report.legs[0].ceilingRatio} />}

      <div className={`grid gap-6 ${both ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
        {report.legs.map((leg) => (
          <div key={leg.id} className="flex flex-col gap-3">
            {both ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-[13px]">{leg.label}</span>
                  <Headline leg={leg} ceiling={ceiling} compact />
                </div>
                <CeilingBar ratio={leg.ceilingRatio} />
              </>
            ) : null}

            <dl className="text-[14px]">
              <Row label="Audio processed">
                {report.audioMinutes.toFixed(2)} min
                {report.audioMinutesEstimated ? (
                  <span className="text-[var(--text-muted)]"> (est. from file size)</span>
                ) : null}
              </Row>
              <Row label="Gemini tokens">
                {tokens(leg.inputTokens)} in · {tokens(leg.outputTokens)} out
              </Row>
              <Row label="API cost" per={leg.apiPerMin}>
                {usd(leg.apiUsd)}
                {leg.apiRatesKnown ? null : <span className="text-[var(--text-muted)]"> (rate unknown)</span>}
              </Row>
              <Row label="Compute cost (est.)" per={leg.computePerMin}>
                {usd(leg.computeUsd)}
              </Row>
              <Row label="Total" per={leg.totalPerMin} strong>
                {usd(leg.totalUsd)}
              </Row>
            </dl>
          </div>
        ))}
      </div>

      <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
        API cost is priced from the measured token counts this batch returned. Compute cost applies the published
        Cloud Run rate (2 vCPU, 8 GiB) to measured wall time — an estimate of marginal cost, not a billed figure, and
        it excludes the always-warm instance&apos;s idle time.
      </p>
    </section>
  );
}

function Headline({ leg, ceiling, compact }: { leg: CostLeg; ceiling: number; compact?: boolean }) {
  const over = leg.ceilingRatio > 1;
  const deltaPct = Math.abs(1 - leg.ceilingRatio) * 100;

  return (
    <div className="flex flex-col items-start sm:items-end gap-0.5">
      <span className={`font-mono tracking-tight ${compact ? "text-[18px]" : "text-[24px]"}`}>
        {usd(leg.totalPerMin)} <span className="text-[var(--text-muted)]">/ audio-minute</span>
      </span>
      <span className={`text-[12px] font-mono ${over ? "text-[var(--warn)]" : "text-[var(--text-muted)]"}`}>
        {deltaPct.toFixed(0)}% {over ? "over" : "under"} the {usd(ceiling)} ceiling
      </span>
    </div>
  );
}

function CeilingBar({ ratio }: { ratio: number }) {
  const filled = Math.max(0, Math.min(1, ratio));
  return (
    <div
      className="h-[4px] w-full bg-[var(--border)]"
      role="img"
      aria-label={`${(ratio * 100).toFixed(0)}% of the cost ceiling`}
    >
      <div
        className="h-full"
        style={{
          width: `${filled * 100}%`,
          background: ratio > WARN_AT_CEILING_RATIO ? "var(--warn)" : "var(--text)",
        }}
      />
    </div>
  );
}

function Row({
  label,
  per,
  strong,
  children,
}: {
  label: string;
  per?: number;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-2 border-b border-[var(--border)] last:border-b-0"
      style={{ boxShadow: strong ? "inset 0 1px 0 var(--border-strong)" : undefined }}
    >
      <dt className={strong ? "text-[var(--text)]" : "text-[var(--text-muted)]"}>{label}</dt>
      <dd className="font-mono text-right whitespace-nowrap">
        {children}
        {per !== undefined ? <span className="text-[var(--text-muted)]"> ({usd(per)}/min)</span> : null}
      </dd>
    </div>
  );
}
