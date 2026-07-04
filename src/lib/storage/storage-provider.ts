import type { StorageKind } from "@/lib/storage/roots";

export interface StoragePutResult {
  /** Path relative to the storage kind root (e.g. `2026/07/04/uuid.jpg`). */
  storageKey: string;
  kind: StorageKind;
  bytes: number;
  mimeType: string;
  /** App-relative URL served by GET /api/files/{kind}/... */
  url: string;
}

/**
 * Abstraction over object storage. Local disk today; S3/MinIO can implement the same contract.
 */
export interface StorageProvider {
  put(
    kind: StorageKind,
    storageKey: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<StoragePutResult>;

  getUrl(kind: StorageKind, storageKey: string): string;

  delete(kind: StorageKind, storageKey: string): Promise<boolean>;
}
