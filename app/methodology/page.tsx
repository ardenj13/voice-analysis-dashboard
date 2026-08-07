import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Methodology — Audio Analysis Batch Console",
  description: "How each output field is produced, the design rules behind the pipeline, and its known limits.",
};

// Static content, deliberately hardcoded: this page has to read correctly for
// someone who opened the dashboard without any of the accompanying documents,
// including when no batch has been run.
const FIELD_METHODS: { field: string; method: string }[] = [
  { field: "emotional_tone", method: "Gemini via Vertex AI, windowed, over loudness-normalised audio" },
  { field: "emotional_intensity", method: "same Gemini call — one judgement per window, aggregated on peak" },
  { field: "background_noise_present", method: "frame-median RMS → SNR threshold" },
  { field: "background_noise_type", method: "PANNs CNN14 tagging over non-speech frames only" },
  { field: "background_noise_severity", method: "calibrated SNR bands" },
  { field: "audio_quality", method: "DSP features (clipping, bandwidth, C50 proxy) + NISQA when available" },
  { field: "speaker_overlap_present", method: "dual-channel exact → pyannote OSD → pitch/entropy fallback" },
  { field: "long_silence_present", method: "Silero VAD internal gaps, excluding leading and trailing silence" },
  { field: "confidence", method: "per-field boundary distance, isotonic-calibrated" },
];

const LIMITATIONS: string[] = [
  "Noise under continuous speech is systematically under-detected — SNR is measured on non-speech frames, so noise that never appears in a gap is invisible to it.",
  "Speaker overlap falls back to a pitch/entropy heuristic when the pyannote model is disabled. That fallback is genuinely weaker than the model, not equivalent to it.",
  "PANNs was trained on AudioSet, not on narrowband compressed telephony. Noise-type labels on heavily compressed or Opus-coded audio are the least reliable output the pipeline produces.",
  "Tone is conservative by design: ambiguous windows resolve toward neutral, so the pipeline under-calls distressed and upset more often than it over-calls them.",
];

export default function MethodologyPage() {
  return (
    <main className="max-w-[880px] mx-auto px-8 py-12 flex flex-col gap-8">
      <header className="flex flex-col gap-1.5 pb-6 border-b border-[var(--border)]">
        <Link href="/" className="text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] w-fit">
          ← Batch console
        </Link>
        <h1 className="text-[24px] font-medium tracking-tight">Methodology</h1>
        <p className="text-[13px] text-[var(--text-muted)]">
          How each field is produced, what the pipeline deliberately refuses to do, and where it is weakest.
        </p>
      </header>

      <Section title="Architecture">
        <p className="text-[14px] leading-relaxed">
          Eight of the nine output fields come from local deterministic signal processing or small specialist models
          running in-process; only <Mono>emotional_tone</Mono> and <Mono>emotional_intensity</Mono> are sent to an
          LLM, which keeps per-minute cost and latency bounded by measured DSP work rather than by token volume.
        </p>
        <table className="w-full text-[13px] border-collapse mt-1">
          <thead>
            <tr className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
              <th className="text-left font-normal py-2 pr-4">Field</th>
              <th className="text-left font-normal py-2">Method</th>
            </tr>
          </thead>
          <tbody>
            {FIELD_METHODS.map((r) => (
              <tr key={r.field} className="border-t border-[var(--border)]">
                <td className="py-2 pr-4 font-mono align-top whitespace-nowrap">{r.field}</td>
                <td className="py-2 align-top text-[var(--text-muted)]">{r.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Two design rules">
        <ol className="flex flex-col gap-3 text-[14px] leading-relaxed">
          <Rule n={1}>
            Tone runs on loudness-normalised audio (−23 LUFS), and acoustic analysis runs on the raw signal. A loud
            caller and an angry caller are different things; normalising the tone input means absolute level cannot
            drive the emotion label.
          </Rule>
          <Rule n={2}>
            The two halves never read each other&apos;s output. Noise detection cannot see the quality verdict,
            quality cannot see the SNR, and neither can see the tone. Independent measurements can disagree — and a
            disagreement is information, where a cascade would just propagate one early error into every field.
          </Rule>
        </ol>
      </Section>

      <Section title="Privacy">
        <p className="text-[14px] leading-relaxed">
          Gemini is reached through Vertex AI inside this deployment&apos;s own GCP project, authenticated with a
          service account holding only <Mono>roles/aiplatform.user</Mono> — not a consumer API key, and no third-party
          inference vendor. Audio never leaves the project: uploads land on the Cloud Run instance&apos;s local disk,
          are deleted once every file in the batch finishes, and are passed to Vertex within the same project
          boundary. The service itself is pinned to <Mono>us-east4</Mono>; the Vertex endpoint is set by{" "}
          <Mono>VERTEX_LOCATION</Mono>, which ships as <Mono>global</Mono> and can be pinned to{" "}
          <Mono>us-east4</Mono> where regional residency is required.
        </p>
      </Section>

      <Section title="Known limitations">
        <ul className="flex flex-col gap-2.5 text-[14px] leading-relaxed">
          {LIMITATIONS.map((l) => (
            <li key={l} className="pl-4 -indent-4 text-[var(--text-muted)]">
              — {l}
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">{title}</h2>
      {children}
    </section>
  );
}

function Rule({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-3">
      <span className="font-mono text-[var(--text-muted)]">{n}.</span>
      <span>{children}</span>
    </li>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[13px]">{children}</code>;
}
