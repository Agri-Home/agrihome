import { LocalStorageProvider } from "@/lib/storage/local-storage-provider";
import type { StorageProvider } from "@/lib/storage/storage-provider";

let provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!provider) {
    provider = new LocalStorageProvider();
  }
  return provider;
}

/** Test hook: inject a mock provider without touching disk. */
export function setStorageProvider(next: StorageProvider | null): void {
  provider = next;
}
