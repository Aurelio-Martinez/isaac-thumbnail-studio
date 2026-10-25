export const ASSET_CATEGORIES = [
  "characters",
  "collectibles",
  "active-items",
  "trinkets",
  "cards",
  "pills",
  "backgrounds",
  "bosses",
  "uploads",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_CATEGORY_META: Record<
  AssetCategory,
  { label: string; plural: string; hint: string }
> = {
  characters: {
    label: "Character",
    plural: "Characters",
    hint: "Player sprites and portraits",
  },
  collectibles: {
    label: "Item",
    plural: "Collectibles",
    hint: "Passive item pedestal icons",
  },
  "active-items": {
    label: "Active",
    plural: "Active Items",
    hint: "Activated collectibles",
  },
  trinkets: { label: "Trinket", plural: "Trinkets", hint: "Small passive pickups" },
  cards: { label: "Card", plural: "Cards", hint: "Cards, runes, and pickups" },
  pills: { label: "Pill", plural: "Pills", hint: "Pill and horse pill icons" },
  backgrounds: {
    label: "Background",
    plural: "Backgrounds",
    hint: "Room screenshots and studio backdrops",
  },
  bosses: { label: "Boss", plural: "Bosses", hint: "Boss portraits and sprites" },
  uploads: { label: "Upload", plural: "Your Uploads", hint: "Images stored in this browser" },
};

export type AssetLicenseStatus = "original" | "copyrighted" | "public-domain" | "unknown";

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  sourceName: string;
  providerId: string;
  licenseStatus: AssetLicenseStatus;
  attribution: string;
  licenseNote: string;
  width: number;
  height: number;
  tags: string[];
  searchTerms: string[];
  localPath?: string;
  synonym?: string;
  uploadId?: string;
  mime?: string;
}

/** Small, portable subset embedded in scenes and saved projects. */
export interface AssetRef {
  id: string;
  name: string;
  category: AssetCategory;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  sourceName: string;
  licenseStatus: AssetLicenseStatus;
  attribution: string;
  width: number;
  height: number;
  providerId: string;
  uploadId?: string;
}

export function toAssetRef(asset: Asset): AssetRef {
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

export interface AssetSearchOptions {
  query: string;
  category: AssetCategory | "all";
  limit: number;
  cursor?: string | null;
  signal?: AbortSignal;
}

export interface AssetPage {
  assets: Asset[];
  nextCursor: string | null;
  total?: number;
}

export interface AssetProvider {
  id: string;
  name: string;
  shortName: string;
  kind: "local" | "remote";
  attribution: string;
  /** Category-specific browse/cursor endpoint. */
  list(options: AssetSearchOptions): Promise<AssetPage>;
  search(options: AssetSearchOptions): Promise<AssetPage>;
}

export type AssetSourceId = "wikigg" | "fandom" | "uploads";
