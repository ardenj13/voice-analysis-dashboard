import JSZip from "jszip";

export const AUDIO_EXTENSIONS = [
  ".wav",
  ".mp3",
  ".m4a",
  ".flac",
  ".ogg",
  ".opus",
  ".aac",
  ".webm",
];

export interface ExtractedFile {
  path: string; // path relative to the detected batch root
  basename: string; // filename used for matching
  size: number;
  flattened: boolean; // true when nested deeper than the root and matched by basename only
  ext: string;
  getBlob: () => Promise<Blob>;
}

export interface ExtractedBatch {
  audioFiles: ExtractedFile[];
  csvFiles: ExtractedFile[];
  unsupportedFiles: ExtractedFile[];
  totalDecompressedSize: number;
  openError?: string;
}

interface RawEntry {
  path: string;
  size: number;
  getBlob: () => Promise<Blob>;
}

function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function shouldIgnorePath(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  const basename = segments[segments.length - 1] ?? "";
  if (segments.includes("__MACOSX")) return true;
  if (basename.startsWith("._")) return true;
  if (basename === ".DS_Store" || basename === "Thumbs.db" || basename === "desktop.ini") return true;
  return false;
}

function classifyEntries(entries: RawEntry[]): ExtractedBatch {
  const filtered = entries.filter((e) => !shouldIgnorePath(e.path) && e.size > 0);

  const hasRootLevelFile = filtered.some((e) => !e.path.includes("/"));
  let root = "";
  if (!hasRootLevelFile) {
    const firstSegments = new Set(filtered.map((e) => e.path.split("/")[0]));
    if (firstSegments.size === 1) {
      root = [...firstSegments][0];
    }
  }

  const audioFiles: ExtractedFile[] = [];
  const csvFiles: ExtractedFile[] = [];
  const unsupportedFiles: ExtractedFile[] = [];
  let totalDecompressedSize = 0;

  for (const entry of filtered) {
    let rel = entry.path;
    if (root && (rel === root || rel.startsWith(root + "/"))) {
      rel = rel.slice(root.length + 1);
    }
    if (!rel) continue;

    const segments = rel.split("/");
    const basename = segments[segments.length - 1];
    const flattened = segments.length > 1;
    const ext = getExt(basename);

    totalDecompressedSize += entry.size;

    const file: ExtractedFile = {
      path: rel,
      basename,
      size: entry.size,
      flattened,
      ext,
      getBlob: entry.getBlob,
    };

    if (ext === ".csv") {
      csvFiles.push(file);
    } else if (AUDIO_EXTENSIONS.includes(ext)) {
      audioFiles.push(file);
    } else {
      unsupportedFiles.push(file);
    }
  }

  return { audioFiles, csvFiles, unsupportedFiles, totalDecompressedSize };
}

export async function extractZip(file: File): Promise<ExtractedBatch> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return {
      audioFiles: [],
      csvFiles: [],
      unsupportedFiles: [],
      totalDecompressedSize: 0,
      openError: "Could not open archive. The file may be corrupt or not a valid ZIP.",
    };
  }

  const rawEntries: RawEntry[] = [];
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    if (shouldIgnorePath(entry.name)) continue;
    let blob: Blob;
    try {
      blob = await entry.async("blob");
    } catch {
      continue;
    }
    if (blob.size === 0) continue;
    rawEntries.push({ path: entry.name, size: blob.size, getBlob: () => Promise.resolve(blob) });
  }

  return classifyEntries(rawEntries);
}

export async function extractFileList(fileList: FileList): Promise<ExtractedBatch> {
  const rawEntries: RawEntry[] = [];
  for (const file of Array.from(fileList)) {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    if (shouldIgnorePath(path)) continue;
    if (file.size === 0) continue;
    rawEntries.push({ path, size: file.size, getBlob: () => Promise.resolve(file) });
  }
  return classifyEntries(rawEntries);
}

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (success: (file: File) => void, error: (err: unknown) => void) => void;
  createReader?: () => {
    readEntries: (success: (entries: FileSystemEntryLike[]) => void, error: (err: unknown) => void) => void;
  };
}

async function traverseEntry(entry: FileSystemEntryLike, path: string, out: RawEntry[]): Promise<void> {
  if (entry.isFile && entry.file) {
    await new Promise<void>((resolve) => {
      entry.file!((file) => {
        const fullPath = path ? `${path}/${file.name}` : file.name;
        if (!shouldIgnorePath(fullPath) && file.size > 0) {
          out.push({ path: fullPath, size: file.size, getBlob: () => Promise.resolve(file) });
        }
        resolve();
      }, () => resolve());
    });
  } else if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    const all: FileSystemEntryLike[] = await new Promise((resolve) => {
      const acc: FileSystemEntryLike[] = [];
      const readBatch = () => {
        reader.readEntries((batch) => {
          if (batch.length === 0) {
            resolve(acc);
            return;
          }
          acc.push(...batch);
          readBatch();
        }, () => resolve(acc));
      };
      readBatch();
    });
    const nextPath = path ? `${path}/${entry.name}` : entry.name;
    for (const child of all) {
      await traverseEntry(child, nextPath, out);
    }
  }
}

export type DropOutcome = { kind: "zip"; file: File } | { kind: "batch"; batch: ExtractedBatch };

export async function extractDataTransfer(dataTransfer: DataTransfer): Promise<DropOutcome> {
  const files = Array.from(dataTransfer.files || []);

  if (files.length === 1 && getExt(files[0].name) === ".zip") {
    return { kind: "zip", file: files[0] };
  }

  const items = Array.from(dataTransfer.items || []);
  const entries = items
    .map((item) => (item.webkitGetAsEntry ? (item.webkitGetAsEntry() as unknown as FileSystemEntryLike | null) : null))
    .filter((e): e is FileSystemEntryLike => e !== null);

  if (entries.length > 0) {
    const out: RawEntry[] = [];
    for (const entry of entries) {
      await traverseEntry(entry, "", out);
    }
    return { kind: "batch", batch: classifyEntries(out) };
  }

  const out: RawEntry[] = files.map((file) => ({
    path: file.name,
    size: file.size,
    getBlob: () => Promise.resolve(file),
  }));
  return { kind: "batch", batch: classifyEntries(out) };
}
