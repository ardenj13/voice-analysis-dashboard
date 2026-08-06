"use client";

import { useRef, useState } from "react";

interface DropZoneProps {
  onZip: (file: File) => void;
  onFolder: (files: FileList) => void;
  onDrop: (dataTransfer: DataTransfer) => void;
}

const ACCEPTED_EXTENSIONS = [".wav", ".mp3", ".m4a", ".flac", ".ogg", ".opus", ".aac", ".webm"];

function UploadIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "var(--text)" : "var(--text-muted)"}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transition: "stroke 120ms" }}
      aria-hidden="true"
    >
      <path d="M12 4v11" />
      <path d="M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4.5 16v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V16" />
    </svg>
  );
}

export default function DropZone({ onZip, onFolder, onDrop }: DropZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop a ZIP archive or a batch folder here, or press Enter to choose a ZIP file"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            zipInputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          onDrop(e.dataTransfer);
        }}
        className="flex flex-col items-center justify-center gap-5 rounded-[4px] border border-dashed cursor-pointer px-8 py-16"
        style={{
          transitionProperty: "background-color, border-color",
          transitionDuration: "120ms",
          borderColor: dragActive ? "var(--border-strong)" : "var(--border)",
          background: dragActive ? "#ffffff" : "var(--surface)",
        }}
      >
        <div
          className="w-[56px] h-[56px] rounded-full flex items-center justify-center border"
          style={{
            borderColor: dragActive ? "var(--border-strong)" : "var(--border)",
            background: "#ffffff",
            transition: "border-color 120ms",
          }}
        >
          <UploadIcon active={dragActive} />
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="text-[16px] font-medium tracking-tight text-[var(--text)]">
            Drop a ZIP archive or a batch folder here
          </p>
          <p className="text-[13px] text-[var(--text-muted)] max-w-[380px]">
            Audio files plus a CSV manifest with <span className="font-mono">name</span> and{" "}
            <span className="font-mono">result_json</span> columns.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full max-w-[280px]" aria-hidden="true">
          <span className="h-px flex-1" style={{ background: "var(--border)" }} />
          <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-faint)]">or</span>
          <span className="h-px flex-1" style={{ background: "var(--border)" }} />
        </div>

        <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn-primary" onClick={() => zipInputRef.current?.click()}>
            Choose ZIP
          </button>
          <button type="button" className="btn-secondary" onClick={() => folderInputRef.current?.click()}>
            Choose folder
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-[420px]" aria-hidden="true">
          {ACCEPTED_EXTENSIONS.map((ext) => (
            <span
              key={ext}
              className="font-mono text-[11px] text-[var(--text-muted)] border rounded-[4px] px-[6px] py-[2px]"
              style={{ borderColor: "var(--border)", background: "#ffffff" }}
            >
              {ext}
            </span>
          ))}
        </div>
      </div>

      <input
        ref={zipInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onZip(file);
          e.target.value = "";
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        {...({ webkitdirectory: "true", directory: "true" } as Record<string, string>)}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFolder(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
