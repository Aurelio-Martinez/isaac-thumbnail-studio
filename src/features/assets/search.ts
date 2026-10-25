import type { Asset } from "@/features/assets/types";
import { normalizeText } from "@/lib/utils";

export class AssetSourceError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, code = "source_error", retryable = true) {
    super(message);
    this.name = "AssetSourceError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function matchesQuery(asset: Asset, query: string): boolean {
  const normalized = normalizeText(query);
  if (!normalized) return true;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const haystack = normalizeText(
    [asset.name, asset.category, asset.synonym ?? "", ...asset.tags, ...asset.searchTerms].join(
      " ",
    ),
  );
  return tokens.every((token) => haystack.includes(token));
}
