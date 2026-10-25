import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Asset, AssetCategory } from "@/features/assets/types";
import { AssetSourceError } from "@/features/assets/search";
import { getWikiProvider, isAbortError, type RemoteSourceId } from "@/features/assets/wikiProvider";
import { safeErrorMessage } from "@/lib/utils";

type LoadState = "idle" | "loading" | "ready" | "error";

export interface AssetSearchParams {
  query: string;
  category: AssetCategory | "all";
  remoteEnabled: boolean;
  providerId: RemoteSourceId;
}

export interface AssetSearchResult {
  remote: Asset[];
  remoteState: LoadState;
  remoteError: string | null;
  nextCursor: string | null;
  loadingMore: boolean;
  retry: () => void;
  loadMore: () => Promise<void>;
  /** True when a query is searching across all categories. */
  globalSearch: boolean;
}

const REMOTE_LIMIT = 42;
const SEARCH_DEBOUNCE = 320;

export function useAssetSearch(params: AssetSearchParams): AssetSearchResult {
  const { query, category, remoteEnabled, providerId } = params;
  const [remote, setRemote] = useState<Asset[]>([]);
  const [remoteState, setRemoteState] = useState<LoadState>("idle");
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const generation = useRef(0);

  const trimmed = query.trim();
  const globalSearch = trimmed.length > 0;
  const provider = useMemo(() => getWikiProvider(providerId), [providerId]);

  useEffect(() => {
    const currentGeneration = generation.current + 1;
    generation.current = currentGeneration;
    setNextCursor(null);
    setRemoteError(null);

    const shouldSearch = trimmed.length >= 2;
    const shouldBrowse = trimmed.length === 0 && category !== "all" && category !== "uploads";
    if (!remoteEnabled || category === "uploads" || (!shouldSearch && !shouldBrowse)) {
      setRemote([]);
      setRemoteState("idle");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(
      () => {
        setRemoteState("loading");
        setRemote([]);
        const options = {
          query: shouldSearch ? trimmed : "",
          category: shouldSearch ? ("all" as const) : category,
          limit: REMOTE_LIMIT,
          signal: controller.signal,
        };
        const request = shouldSearch ? provider.search(options) : provider.list(options);
        request
          .then((page) => {
            if (generation.current !== currentGeneration || controller.signal.aborted) return;
            setRemote(page.assets);
            setNextCursor(page.nextCursor);
            setRemoteState("ready");
          })
          .catch((error: unknown) => {
            if (
              generation.current !== currentGeneration ||
              controller.signal.aborted ||
              isAbortError(error)
            ) {
              return;
            }
            setRemoteError(
              error instanceof AssetSourceError
                ? error.message
                : safeErrorMessage(error, "The online artwork source is unavailable."),
            );
            setRemoteState("error");
          });
      },
      shouldSearch ? SEARCH_DEBOUNCE : 0,
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, category, remoteEnabled, provider, reloadKey]);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const options = {
        query: globalSearch ? trimmed : "",
        category: globalSearch ? ("all" as const) : category,
        limit: REMOTE_LIMIT,
        cursor: nextCursor,
      };
      const page = globalSearch ? await provider.search(options) : await provider.list(options);
      setRemote((current) => {
        const seen = new Set(current.map((asset) => asset.id));
        return [...current, ...page.assets.filter((asset) => !seen.has(asset.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (!isAbortError(error)) {
        setRemoteError(safeErrorMessage(error, "Could not load more artwork."));
      }
    } finally {
      setLoadingMore(false);
    }
  }, [category, globalSearch, loadingMore, nextCursor, provider, trimmed]);

  return {
    remote,
    remoteState,
    remoteError,
    nextCursor,
    loadingMore,
    retry,
    loadMore,
    globalSearch,
  };
}
