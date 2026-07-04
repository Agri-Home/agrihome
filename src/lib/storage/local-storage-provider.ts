import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

import { type StorageKind, getRootForKind } from "@/lib/storage/roots";
import type { StorageProvider, StoragePutResult } from "@/lib/storage/storage-provider";

export class LocalStorageProvider implements StorageProvider {
  async put(
    kind: StorageKind,
    storageKey: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<StoragePutResult> {
    const root = getRootForKind(kind);
    const absolutePath = path.join(root, storageKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      storageKey,
      kind,
      bytes: buffer.length,
      mimeType,
      url: `/api/files/${kind}/${storageKey}`
    };
  }

  getUrl(kind: StorageKind, storageKey: string): string {
    return `/api/files/${kind}/${storageKey}`;
  }

  async delete(kind: StorageKind, storageKey: string): Promise<boolean> {
    const root = getRootForKind(kind);
    const absolutePath = path.join(root, storageKey);
    try {
      await unlink(absolutePath);
      return true;
    } catch {
      return false;
    }
  }
}
