import fs from "fs";
import path from "path";

import { getOriginalsRoot } from "@/lib/storage/roots";

export interface OriginalsUsageStats {
  fileCount: number;
  bytesTotal: number;
}

function walkFiles(dir: string, onFile: (filePath: string, size: number) => void): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, onFile);
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    try {
      const stat = fs.statSync(fullPath);
      onFile(fullPath, stat.size);
    } catch {
      // skip unreadable files
    }
  }
}

/** Aggregate originals disk usage without exposing filesystem paths. */
export function getOriginalsUsageStats(): OriginalsUsageStats {
  const root = getOriginalsRoot();
  let fileCount = 0;
  let bytesTotal = 0;

  if (!fs.existsSync(root)) {
    return { fileCount, bytesTotal };
  }

  walkFiles(root, (_filePath, size) => {
    fileCount += 1;
    bytesTotal += size;
  });

  return { fileCount, bytesTotal };
}

export function parseStorageQuotaBytes(): number | null {
  const raw = process.env.STORAGE_QUOTA_BYTES?.trim();
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function utilizationPercent(bytesTotal: number, quotaBytes: number): number {
  return Math.min(100, Math.round((bytesTotal / quotaBytes) * 1000) / 10);
}
