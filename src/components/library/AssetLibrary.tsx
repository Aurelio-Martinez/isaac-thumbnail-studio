import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Clock,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Star,
  Upload,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { STORAGE_KEYS } from "@/config";
import { useAssetSearch } from "@/features/assets/useAssetSearch";
import { REMOTE_SOURCES, type RemoteSourceId } from "@/features/assets/wikiProvider";
import { listUploads, saveUpload } from "@/features/assets/uploads";
import { useLibraryStore } from "@/features/assets/libraryStore";
import { ASSET_CATEGORIES, ASSET_CATEGORY_META, type AssetRef } from "@/features/assets/types";
import { useEditorStore } from "@/features/editor/store";
import { useUiStore } from "@/features/editor/uiStore";
import { AssetCard, type CardAsset } from "@/components/library/AssetCard";
import { Input, Select } from "@/components/ui/form";
import { SwitchField } from "@/components/ui/controls";
import { notify } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type LibraryTab = "browse" | "recent" | "favorites";

const CATEGORY_TABS: Array<{ id: (typeof ASSET_CATEGORIES)[number] | "all"; label: string }> = [
  { id: "all", label: "All" },
  ...ASSET_CATEGORIES.filter(
    (category) => category !== "uploads" && category !== "backgrounds",
  ).map((category) => ({
    id: category,
    label: category === "collectibles" ? "Items" : ASSET_CATEGORY_META[category].plural,
  })),
  { id: "uploads", label: "Uploads" },
];

function asRef(asset: CardAsset): AssetRef {
  return {
    id: asset.id,
    name: asset.name,
    category: asset.category,
    imageUrl: asset.imageUrl,
    thumbnailUrl: asset.thumbnailUrl,
    sourceUrl: asset.sourceUrl,
    sourceName: asset.sourceName,
    licenseStatus: asset.licenseStatus,
    attribution: asset.attribution,
    width: asset.width,
    height: asset.height,
    providerId: asset.providerId,
    ...(asset.uploadId ? { uploadId: asset.uploadId } : {}),
  };
}

function readPreference(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferences are non-critical.
  }
}

export function AssetLibrary({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof ASSET_CATEGORIES)[number] | "all">("characters");
  const [tab, setTab] = useState<LibraryTab>("browse");
  const [remoteEnabled, setRemoteEnabled] = useState(
    () => readPreference(STORAGE_KEYS.online, "1") !== "0",
  );
  const [providerId, setProviderId] = useState<RemoteSourceId>(() => {
    const saved = readPreference(STORAGE_KEYS.lastSource, "wikigg-catalog");
    if (saved === "fandom" || saved === "wikigg-live") return saved;
    if (saved === "wikigg") return "wikigg-live";
    return "wikigg-catalog";
  });
  const activeSource =
    REMOTE_SOURCES.find((source) => source.id === providerId) ?? REMOTE_SOURCES[0]!;
  const [uploads, setUploads] = useState<CardAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadVersion, setUploadVersion] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const favorites = useLibraryStore((state) => state.favorites);
  const recent = useLibraryStore((state) => state.recent);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const addRecent = useLibraryStore((state) => state.addRecent);
  const clearRecent = useLibraryStore((state) => state.clearRecent);
  const setSourcesOpen = useUiStore((state) => state.setSourcesOpen);

  const search = useAssetSearch({ query, category, remoteEnabled, providerId });
  const favoriteIds = useMemo(() => new Set(favorites.map((asset) => asset.id)), [favorites]);
  const remoteResults = useMemo(
    () => search.remote.filter((asset) => asset.category !== "backgrounds"),
    [search.remote],
  );

  useEffect(() => {
    writePreference(STORAGE_KEYS.online, remoteEnabled ? "1" : "0");
  }, [remoteEnabled]);

  useEffect(() => {
    writePreference(STORAGE_KEYS.lastSource, providerId);
  }, [providerId]);

  useEffect(() => {
    let cancelled = false;
    listUploads()
      .then((assets) => {
        if (!cancelled) setUploads(assets);
      })
      .catch(() => {
        if (!cancelled) setUploads([]);
      });
    return () => {
      cancelled = true;
    };
  }, [uploadVersion, category]);

  const addAsset = (asset: CardAsset) => {
    const ref = asRef(asset);
    const id = useEditorStore.getState().addAsset(ref);
    if (!id) {
      notify.error(
        "Layer limit reached",
        "Delete a layer before adding more. The studio keeps compositions under 120 layers for performance.",
      );
      return;
    }
    addRecent(ref);
  };

  const setBackground = (asset: CardAsset) => {
    const ref = asRef(asset);
    useEditorStore.getState().setBackgroundAsset(ref);
    addRecent(ref);
    notify.success("Background updated", asset.name);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let added = 0;
    const errors: string[] = [];
    for (const file of Array.from(files).slice(0, 10)) {
      try {
        await saveUpload(file);
        added += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${file.name} could not be uploaded.`);
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploadVersion((value) => value + 1);
    setCategory("uploads");
    setTab("browse");
    if (added > 0) {
      notify.success(
        `${added} image${added === 1 ? "" : "s"} uploaded`,
        "Stored locally in this browser. Add it to the canvas, or use the background button on the card.",
      );
    }
    if (errors.length > 0) {
      notify.error("Some uploads failed", errors.slice(0, 2).join(" "));
    }
  };

  const retryRemote = () => {
    search.retry();
  };

  const uploadResults = uploads.filter((asset) => {
    if (!query.trim()) return true;
    return asset.name.toLowerCase().includes(query.trim().toLowerCase());
  });

  const renderGrid = (assets: CardAsset[], showBackgroundAction: boolean) => (
    <div className="grid grid-cols-2 gap-2">
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          onAdd={addAsset}
          onToggleFavorite={(entry) => toggleFavorite(asRef(entry))}
          isFavorite={favoriteIds.has(asset.id)}
          {...(showBackgroundAction ||
          asset.category === "backgrounds" ||
          asset.category === "uploads"
            ? { onSetBackground: setBackground }
            : {})}
        />
      ))}
    </div>
  );

  return (
    <aside
      className={cn("flex h-full min-h-0 flex-col border-r border-line bg-ink-850", className)}
      aria-label="Artwork library"
    >
      <div className="border-b border-line px-3 pb-2.5 pt-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-lg leading-none tracking-wide text-cream">Artwork</h2>
            <p className="mt-1 text-[10px] text-muted">Wiki artwork + your uploads</p>
          </div>
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              multiple
              className="sr-only"
              onChange={(event) => void handleUpload(event.target.files)}
              aria-label="Upload images"
            />
            <button
              type="button"
              className="flex h-7 items-center gap-1 rounded-[5px] border border-line bg-ink-750 px-2 text-[10px] text-cream-dim transition-colors hover:border-line-strong hover:text-cream focus-visible:outline-2 focus-visible:outline-gold"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Upload your own image"
            >
              {uploading ? (
                <Loader2 className="h-3 w-3 animate-spin-slow" aria-hidden="true" />
              ) : (
                <Upload className="h-3 w-3" aria-hidden="true" />
              )}
              Upload
            </button>
          </div>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <Input
            id="asset-search"
            type="search"
            aria-label="Search artwork"
            placeholder="Search items, characters, rooms…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (tab !== "browse") setTab("browse");
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
                event.currentTarget.blur();
              }
            }}
            className="h-8 pl-8 pr-8 text-[11px]"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-cream focus-visible:outline-2 focus-visible:outline-gold"
              onClick={() => setQuery("")}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="mt-2 flex items-center gap-1" role="group" aria-label="Artwork collections">
          {(
            [
              { id: "browse", label: "Browse", icon: ImageIcon },
              { id: "recent", label: "Recent", icon: Clock },
              { id: "favorites", label: "Favorites", icon: Star },
            ] as const
          ).map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                aria-pressed={tab === entry.id}
                className={cn(
                  "flex h-7 flex-1 items-center justify-center gap-1 rounded-[4px] text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-gold",
                  tab === entry.id
                    ? "bg-ink-700 text-cream"
                    : "text-muted hover:bg-ink-800 hover:text-cream-dim",
                )}
                onClick={() => setTab(entry.id)}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {entry.label}
              </button>
            );
          })}
        </div>

        {tab === "browse" ? (
          <div
            className="mt-2 flex flex-wrap gap-1 pb-1"
            role="group"
            aria-label="Filter by category"
          >
            {CATEGORY_TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={category === entry.id}
                className={cn(
                  "shrink-0 rounded-full border px-2 py-1 text-[9.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-gold",
                  category === entry.id
                    ? "border-gold/60 bg-gold/15 text-gold"
                    : "border-line bg-ink-800 text-muted hover:border-line-strong hover:text-cream-dim",
                )}
                onClick={() => {
                  setCategory(entry.id);
                  setTab("browse");
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {tab === "browse" ? (
          <div className="space-y-4">
            {category === "uploads" ? (
              uploadResults.length === 0 ? (
                <div className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center">
                  <Upload className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
                  <p className="mt-2 text-xs font-medium text-cream">No uploads yet</p>
                  <p className="mt-1 text-[10px] leading-snug text-muted">
                    PNG, JPEG, WebP, GIF, or SVG up to 8 MB. Images stay in this browser.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 rounded border border-line-strong bg-ink-750 px-3 py-1.5 text-[10px] text-cream hover:border-gold"
                  >
                    Choose images
                  </button>
                </div>
              ) : (
                <section aria-label="Your uploads">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="panel-title">Your uploads</h3>
                    <span className="text-[9px] text-muted">{uploadResults.length}</span>
                  </div>
                  {renderGrid(uploadResults, true)}
                </section>
              )
            ) : !remoteEnabled ? (
              <div className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center">
                <WifiOff className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
                <p className="mt-2 text-xs font-medium text-cream">Online artwork is off</p>
                <p className="mt-1 text-[10px] leading-snug text-muted">
                  Turn on the wiki source below to browse characters, items, and backgrounds. Your
                  uploads remain available in the Uploads category.
                </p>
              </div>
            ) : category === "all" && query.trim().length === 0 ? (
              <div className="rounded-md border border-dashed border-line-strong px-4 py-8 text-center">
                <Wifi className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
                <p className="mt-2 text-xs font-medium text-cream">Choose a category</p>
                <p className="mt-1 text-[10px] leading-snug text-muted">
                  Pick Characters, Items, Backgrounds, or another category. You can also search the
                  entire wiki above.
                </p>
              </div>
            ) : query.trim().length === 1 ? (
              <p className="rounded border border-dashed border-line px-3 py-5 text-center text-[10px] text-muted">
                Type at least two characters to search the wiki.
              </p>
            ) : (
              <section aria-label="Online wiki artwork">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="panel-title flex items-center gap-1.5">
                    <Wifi className="h-3 w-3 text-muted" aria-hidden="true" />
                    {activeSource.shortLabel}
                  </h3>
                  {search.remoteState === "ready" ? (
                    <span className="text-[9px] text-muted">{remoteResults.length} loaded</span>
                  ) : null}
                </div>
                {search.globalSearch ? (
                  <p className="mb-2 rounded border border-line bg-ink-800/60 px-2 py-1 text-[9px] leading-snug text-muted">
                    Searching all wiki categories. Category pills filter browsing, not search.
                  </p>
                ) : null}
                {search.remoteState === "idle" || search.remoteState === "loading" ? (
                  <div
                    className="grid grid-cols-2 gap-2"
                    role="status"
                    aria-label="Loading wiki artwork"
                  >
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div
                        key={index}
                        className="aspect-[3/4] animate-pulse rounded-md border border-line bg-ink-800"
                      />
                    ))}
                  </div>
                ) : search.remoteState === "error" ? (
                  <div className="rounded-md border border-ember/40 bg-ember/5 p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-cream">
                      <WifiOff className="h-3.5 w-3.5 text-ember" aria-hidden="true" />
                      Online artwork unavailable
                    </p>
                    <p className="mt-1 text-[10px] leading-snug text-muted">{search.remoteError}</p>
                    <button
                      type="button"
                      className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-gold hover:underline"
                      onClick={retryRemote}
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden="true" /> Retry
                    </button>
                    <p className="mt-1 text-[9px] text-muted">
                      Your uploads are still available in the Uploads category.
                    </p>
                  </div>
                ) : remoteResults.length === 0 ? (
                  <p className="rounded border border-dashed border-line px-3 py-5 text-center text-[10px] text-muted">
                    No artwork matched. Try another term or category.
                  </p>
                ) : (
                  <>
                    {renderGrid(remoteResults, false)}
                    {search.nextCursor ? (
                      <button
                        type="button"
                        onClick={() => void search.loadMore()}
                        disabled={search.loadingMore}
                        className="mt-2 flex h-8 w-full items-center justify-center gap-1.5 rounded border border-line bg-ink-800 text-[10px] text-cream-dim hover:border-gold/50 hover:text-cream disabled:opacity-50"
                      >
                        {search.loadingMore ? (
                          <Loader2 className="h-3 w-3 animate-spin-slow" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-3 w-3" aria-hidden="true" />
                        )}
                        Load more wiki artwork
                      </button>
                    ) : null}
                  </>
                )}
              </section>
            )}
          </div>
        ) : tab === "recent" ? (
          <section aria-label="Recently used artwork">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="panel-title">Recently used</h3>
              {recent.length > 0 ? (
                <button
                  type="button"
                  onClick={clearRecent}
                  className="text-[9px] text-muted hover:text-cream"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {recent.length === 0 ? (
              <div className="rounded-md border border-dashed border-line-strong px-4 py-10 text-center">
                <Clock className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
                <p className="mt-2 text-xs font-medium text-cream">Nothing used yet</p>
                <p className="mt-1 text-[10px] text-muted">
                  Artwork you add to the canvas appears here.
                </p>
              </div>
            ) : (
              renderGrid(recent, false)
            )}
          </section>
        ) : (
          <section aria-label="Favorite artwork">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="panel-title">Favorites</h3>
              <span className="text-[9px] text-muted">{favorites.length}</span>
            </div>
            {favorites.length === 0 ? (
              <div className="rounded-md border border-dashed border-line-strong px-4 py-10 text-center">
                <Star className="mx-auto h-6 w-6 text-muted" aria-hidden="true" />
                <p className="mt-2 text-xs font-medium text-cream">No favorites yet</p>
                <p className="mt-1 text-[10px] text-muted">
                  Tap the star on any card to keep it close.
                </p>
              </div>
            ) : (
              renderGrid(favorites, false)
            )}
          </section>
        )}
      </div>

      <details className="group border-t border-line bg-ink-900/60 px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[10px] text-cream-dim">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                !remoteEnabled
                  ? "bg-muted-dim"
                  : search.remoteState === "error"
                    ? "bg-ember"
                    : search.remoteState === "loading"
                      ? "bg-gold"
                      : "bg-emerald-400",
              )}
              aria-hidden="true"
            />
            Artwork source
          </span>
          <ChevronDown
            className="h-3 w-3 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="mt-2 space-y-2 pb-1">
          <SwitchField
            label="Online wiki artwork"
            checked={remoteEnabled}
            onCheckedChange={setRemoteEnabled}
            hint="Live MediaWiki results. Requires network access."
          />
          <div>
            <label htmlFor="artwork-source" className="field-label">
              Wiki source
            </label>
            <Select
              id="artwork-source"
              value={providerId}
              disabled={!remoteEnabled}
              onChange={(event) => {
                const next = REMOTE_SOURCES.find((source) => source.id === event.target.value);
                if (next) setProviderId(next.id);
              }}
              className="h-8 text-[11px]"
            >
              {REMOTE_SOURCES.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[9px] leading-snug text-muted">{activeSource.hint}</p>
          </div>
          <p className="text-[9px] leading-snug text-muted">
            Game artwork © Nicalis / Edmund McMillen. Files on the wiki are marked IN COPYRIGHT.
            Check each source page before publishing.
          </p>
          <button
            type="button"
            onClick={() => setSourcesOpen(true)}
            className="text-[9.5px] font-semibold text-gold hover:underline"
          >
            Credits &amp; licenses
          </button>
        </div>
      </details>
    </aside>
  );
}
