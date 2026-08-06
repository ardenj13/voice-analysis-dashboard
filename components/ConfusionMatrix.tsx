import type { EmotionalTone } from "@/lib/types";

export default function ConfusionMatrix({ matrix, labels }: { matrix: number[][]; labels: EmotionalTone[] }) {
  const max = Math.max(1, ...matrix.flat());

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-[13px] font-mono">
        <thead>
          <tr>
            <th className="px-2 py-1 text-[11px] text-[var(--text-muted)] font-normal text-left whitespace-nowrap">
              actual \ predicted
            </th>
            {labels.map((l) => (
              <th key={l} className="px-2 py-1 text-[var(--text-muted)] font-normal whitespace-nowrap">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((rowLabel, i) => (
            <tr key={rowLabel}>
              <th className="px-2 py-1 text-[var(--text-muted)] font-normal text-right whitespace-nowrap">{rowLabel}</th>
              {matrix[i].map((count, j) => (
                <td
                  key={j}
                  className="w-[44px] h-[36px] text-center border border-[var(--border)]"
                  style={{
                    background:
                      count > 0
                        ? `color-mix(in srgb, var(--text) ${Math.min(45, Math.round((count / max) * 45))}%, white)`
                        : "#fff",
                    boxShadow: i === j ? "inset 0 0 0 1px var(--border-strong)" : undefined,
                  }}
                >
                  {count}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
