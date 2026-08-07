"use client";

import { useState } from "react";
import { login } from "@/lib/api";

export default function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-[360px] mx-auto px-8 py-24 flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <div className="w-[28px] h-[28px] rounded-[4px] bg-[var(--text)] flex items-center justify-center shrink-0">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <rect x="0" y="5" width="2" height="4" fill="#ffffff" />
            <rect x="3.5" y="2" width="2" height="10" fill="#ffffff" />
            <rect x="7" y="0" width="2" height="14" fill="#ffffff" />
            <rect x="10.5" y="3" width="2" height="8" fill="#ffffff" />
          </svg>
        </div>
        <h1 className="text-[18px] font-medium tracking-tight">Audio Analysis Batch Console</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            className="h-[36px] px-3 rounded-[4px] border border-[var(--border)] text-[14px] font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-[12px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="h-[36px] px-3 rounded-[4px] border border-[var(--border)] text-[14px] font-mono"
          />
        </div>

        {error ? <p className="text-[14px] text-[var(--err)]">{error}</p> : null}

        <button type="submit" className="btn-primary" disabled={submitting || !username || !password}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
