import type { Asset, AssetRef } from "@/features/assets/types";
import { createTextLayer, type TextLayer } from "@/features/editor/types";

export const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export function makeAssetRef(overrides: Partial<AssetRef> = {}): AssetRef {
  return {
    id: "wikigg-file-1",
    name: "Test Item",
    category: "collectibles",
    imageUrl: "https://bindingofisaacrebirth.wiki.gg/images/Test_Item_icon.png",
    thumbnailUrl: "https://bindingofisaacrebirth.wiki.gg/images/thumb/Test_Item_icon.png/64px.png",
    sourceUrl: "https://bindingofisaacrebirth.wiki.gg/wiki/File:Test_Item_icon.png",
    sourceName: "The Binding of Isaac: Rebirth Wiki (wiki.gg)",
    licenseStatus: "copyrighted",
    attribution: "Artwork © Nicalis / Edmund McMillen.",
    width: 32,
    height: 32,
    providerId: "wikigg",
    ...overrides,
  };
}

export function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "wikigg-file-99",
    name: "Test Sprite",
    category: "characters",
    imageUrl: "https://bindingofisaacrebirth.wiki.gg/images/Test_Sprite.png",
    thumbnailUrl: "https://bindingofisaacrebirth.wiki.gg/images/Test_Sprite.png",
    sourceUrl: "https://bindingofisaacrebirth.wiki.gg/wiki/File:Test_Sprite.png",
    sourceName: "The Binding of Isaac: Rebirth Wiki (wiki.gg)",
    providerId: "wikigg",
    licenseStatus: "copyrighted",
    attribution: "Artwork © Nicalis / Edmund McMillen.",
    licenseNote: "Game artwork is marked IN COPYRIGHT.",
    width: 32,
    height: 32,
    tags: ["test"],
    searchTerms: ["test", "sprite"],
    mime: "image/png",
    ...overrides,
  };
}

export function makeText(overrides: Partial<TextLayer> = {}): TextLayer {
  return createTextLayer(overrides);
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
