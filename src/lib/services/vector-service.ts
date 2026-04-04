import { QdrantClient } from "@qdrant/js-client-rest";

import { env, hasVectorConfig } from "@/lib/config/env";
import type { CameraCapture, SimilarImageMatch } from "@/lib/types/domain";

declare global {
  var __agrihomeQdrantClient__:
    | QdrantClient
    | null
    | undefined;
}

const buildPseudoEmbedding = (seed: string) => {
  const values = Array.from({ length: 8 }, (_, index) => {
    const code = seed.charCodeAt(index % seed.length) || 0;

    return Number((code / 255).toFixed(4));
  });

  return values;
};

const getQdrantClient = () => {
  if (!hasVectorConfig) {
    return null;
  }

  if (!globalThis.__agrihomeQdrantClient__) {
    globalThis.__agrihomeQdrantClient__ = new QdrantClient({
      url: env.qdrant.url,
      apiKey: env.qdrant.apiKey || undefined
    });
  }

  return globalThis.__agrihomeQdrantClient__;
};

export const getVectorSource = () => (getQdrantClient() ? "qdrant" : "unavailable");

export const findSimilarImages = async (
  capture: CameraCapture
): Promise<SimilarImageMatch[]> => {
  const client = getQdrantClient();

  if (!client) {
    return [];
  }

  try {
    const results = await client.search(env.qdrant.collection, {
      vector: buildPseudoEmbedding(capture.id),
      limit: 3,
      with_payload: true
    });

    return results.map((match, index) => ({
      id: String(match.id ?? `qdrant-${index}`),
      label:
        typeof match.payload?.label === "string"
          ? match.payload.label
          : `Reference ${index + 1}`,
      score: Number(match.score ?? 0),
      imageUrl:
        typeof match.payload?.imageUrl === "string"
          ? match.payload.imageUrl
          : capture.imageUrl
    }));
  } catch {
    return [];
  }
};
