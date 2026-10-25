import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function resetStorage(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
}

async function readSavedProject(page: Page) {
  return page.evaluate(() => {
    const active = window.localStorage.getItem("its.active-project.v1");
    const projects = JSON.parse(window.localStorage.getItem("its.projects.v1") ?? "[]");
    return projects.find((project: { id: string }) => project.id === active) as
      | {
          id: string;
          name: string;
          scene: {
            background: { mode: string; asset?: { name?: string } | null };
            layers: Array<{
              id: string;
              name: string;
              type: string;
              x: number;
              y: number;
              width: number;
              text?: string;
              effects: {
                outline: {
                  width: number;
                  referenceSize?: number;
                };
              };
            }>;
          };
        }
      | undefined;
  });
}

async function addFirstSearchResult(page: Page, query: string, result: RegExp) {
  await page.getByLabel("Search artwork").fill(query);
  const card = page.getByRole("button", { name: result }).first();
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.click();
}

test("creates, edits, exports, and restores a thumbnail with wiki artwork", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  // Keep the export test deterministic even when the live image proxy is being
  // rate-limited by the wiki host. Catalog metadata still comes from the app.
  await page.route("**/api/asset-proxy*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect x="4" y="4" width="56" height="56" rx="6" fill="#d5aa4a"/><rect x="14" y="14" width="36" height="36" fill="#17171d"/><rect x="24" y="24" width="16" height="16" fill="#f2ece0"/></svg>`,
    }),
  );

  await resetStorage(page);
  await expect(page.getByText("Start with a spark")).toBeVisible();
  await expect(page.getByRole("button", { name: "Use a transparent background" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Character + two items from the verified wiki catalog.
  await page.getByRole("button", { name: "Characters", exact: true }).click();
  const character = page.getByRole("button", { name: /Add .*Isaac Character/ }).first();
  await expect(character).toBeVisible({ timeout: 20_000 });
  await character.click();

  await addFirstSearchResult(page, "yum heart", /Add .*Yum Heart/);
  await addFirstSearchResult(page, "sacred heart", /Add .*Sacred Heart/);

  // Move the most recently added item by dragging it on the Konva canvas.
  const stage = page.locator("[role='application']");
  const box = await stage.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    const zoom = box.width / 1280;
    const centerX = box.x + 640 * zoom;
    const centerY = box.y + 360 * zoom;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 64, centerY + 44, { steps: 10 });
    await page.mouse.up();
  }

  // Add and edit a text layer.
  await page.keyboard.press("t");
  const textInput = page.locator("#text-content-input");
  await expect(textInput).toBeVisible();
  await textInput.fill("E2E RUN");
  // Shortcuts intentionally ignore text fields; leave the field before saving.
  await page.getByRole("tab", { name: /Design/ }).click();
  await page.waitForTimeout(200);

  await page.keyboard.press("Control+s");
  await expect
    .poll(async () => (await readSavedProject(page))?.scene.layers.length, { timeout: 10_000 })
    .toBe(4);

  const savedBeforeReload = await readSavedProject(page);
  const names = savedBeforeReload?.scene.layers.map((layer) => layer.name) ?? [];
  expect(names).toContain("Yum Heart");
  expect(names).toContain("Sacred Heart");
  expect(names).toContain("Headline");
  expect(savedBeforeReload?.scene.background.mode).toBe("transparent");
  const sacred = savedBeforeReload?.scene.layers.find((layer) => layer.name === "Sacred Heart");
  expect(sacred?.x).toBeGreaterThan(650);
  expect(sacred?.y).toBeGreaterThan(365);

  // Export a real 1280x720 PNG through the scene renderer.
  await page.getByRole("button", { name: "Export PNG" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("1280 × 720 · PNG")).toBeVisible();
  await expect(dialog.getByText("Transparent PNG")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^isaac-thumbnail-\d{4}-\d{2}-\d{2}\.png$/);
  const filePath = test.info().outputPath("exported.png");
  await download.saveAs(filePath);
  const bytes = await readFile(filePath);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(bytes.readUInt32BE(16)).toBe(1280);
  expect(bytes.readUInt32BE(20)).toBe(720);
  await expect(dialog.getByText("Export complete")).toBeVisible();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  // Reload and verify the project was restored from local storage.
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Export PNG" })).toBeVisible();
  await page.getByRole("tab", { name: /Layers/ }).click();
  await expect(page.locator("ul[aria-label='Layers, top layer first'] > li")).toHaveCount(4);
  await page.getByRole("button", { name: /Select Headline layer/ }).click();
  await page.getByRole("tab", { name: /Design/ }).click();
  await expect(page.locator("#text-content-input")).toHaveValue("E2E RUN");
  await page.getByRole("tab", { name: /Layers/ }).click();
  await page.getByRole("button", { name: /Select Sacred Heart layer/ }).click();
  await page.getByRole("tab", { name: /Design/ }).click();
  await expect(page.getByLabel("X (center)")).not.toHaveValue("640");

  expect(pageErrors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath("restored.png"), fullPage: false });
});

test("uploads an image, exports transparency, and moves it through portable JSON", async ({
  page,
  browser,
}) => {
  await resetStorage(page);
  const screenshot = await page.screenshot();
  await page.locator('input[aria-label="Upload images"]').setInputFiles({
    name: "studio-shot.png",
    mimeType: "image/png",
    buffer: screenshot,
  });
  await expect(page.getByText("1 image uploaded")).toBeVisible();
  await page.getByRole("button", { name: /Add studio-shot/ }).click();
  await page.keyboard.press("Control+s");

  // The default canvas is transparent; transparent export must retain alpha.
  await page.getByRole("button", { name: "Export PNG" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Transparent PNG")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export PNG" }).click();
  const download = await downloadPromise;
  const transparentPath = test.info().outputPath("transparent.png");
  await download.saveAs(transparentPath);
  const transparentBytes = await readFile(transparentPath);
  const alpha = await page.evaluate(
    async (dataUrl) => {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = dataUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const context2d = canvas.getContext("2d");
      if (!context2d) throw new Error("Canvas 2D is unavailable");
      context2d.drawImage(image, 0, 0);
      return context2d.getImageData(0, 0, 1, 1).data[3];
    },
    `data:image/png;base64,${transparentBytes.toString("base64")}`,
  );
  expect(alpha).toBe(0);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "More project actions" }).click();
  const jsonPromise = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Save project as JSON…" }).click();
  const jsonDownload = await jsonPromise;
  const jsonPath = test.info().outputPath("portable.json");
  await jsonDownload.saveAs(jsonPath);
  const portable = JSON.parse(await readFile(jsonPath, "utf8"));
  expect(Object.keys(portable.embeddedAssets ?? {})).toHaveLength(1);
  expect(portable.scene.background.mode).toBe("transparent");
  expect(
    portable.scene.layers.some(
      (layer: { type: string; asset?: { uploadId?: string } }) =>
        layer.type === "image" && Boolean(layer.asset?.uploadId),
    ),
  ).toBe(true);

  // A clean browser context should recover the embedded image from JSON.
  const cleanContext = await browser.newContext({ acceptDownloads: true });
  const importedPage = await cleanContext.newPage();
  const baseURL = test.info().project.use.baseURL ?? "http://localhost:4173";
  await importedPage.goto(baseURL, { waitUntil: "networkidle" });
  await importedPage.locator('input[aria-label="Import project JSON"]').setInputFiles(jsonPath);
  await importedPage.getByRole("tab", { name: /Layers/ }).click();
  await expect(importedPage.locator("ul[aria-label='Layers, top layer first'] > li")).toHaveCount(
    1,
  );
  await importedPage.getByRole("button", { name: "Export PNG" }).click();
  const importedDialog = importedPage.getByRole("dialog");
  const importedDownloadPromise = importedPage.waitForEvent("download");
  await importedDialog.getByRole("button", { name: "Export PNG" }).click();
  const importedDownload = await importedDownloadPromise;
  const importedPath = test.info().outputPath("imported.png");
  await importedDownload.saveAs(importedPath);
  const importedBytes = await readFile(importedPath);
  expect(importedBytes.readUInt32BE(16)).toBe(1280);
  expect(importedBytes.readUInt32BE(20)).toBe(720);
  await cleanContext.close();
});

test("keeps an image outline proportionate when the layer is resized", async ({ page }) => {
  await page.route("**/api/asset-proxy*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect x="4" y="4" width="56" height="56" rx="6" fill="#d5aa4a"/><rect x="14" y="14" width="36" height="36" fill="#17171d"/><rect x="24" y="24" width="16" height="16" fill="#f2ece0"/></svg>`,
    }),
  );

  await resetStorage(page);
  await page.getByRole("button", { name: "Characters", exact: true }).click();
  const character = page.getByRole("button", { name: /Add .*Isaac Character/ }).first();
  await expect(character).toBeVisible({ timeout: 20_000 });
  await character.click();
  await page.getByRole("tab", { name: /Design/ }).click();

  const widthInputs = page.getByLabel("Width", { exact: true });
  await expect(widthInputs).toHaveCount(2);
  const layerWidthInput = widthInputs.first();
  const outlineWidthInput = widthInputs.last();
  const originalWidth = Number(await layerWidthInput.inputValue());
  expect(originalWidth).toBeGreaterThan(100);
  await expect(outlineWidthInput).toHaveValue("4");

  const shrunkWidth = Math.round((originalWidth / 2) * 10) / 10;
  await layerWidthInput.fill(String(shrunkWidth));
  await layerWidthInput.blur();
  await expect.poll(async () => Number(await outlineWidthInput.inputValue())).toBeLessThan(4);

  await page.keyboard.press("Control+s");
  await expect
    .poll(async () => {
      const layer = (await readSavedProject(page))?.scene.layers[0];
      return layer?.effects.outline.referenceSize ?? 0;
    })
    .toBeGreaterThan(shrunkWidth);
  const saved = (await readSavedProject(page))?.scene.layers[0];
  expect(saved?.effects.outline.width).toBe(4);
  expect(saved?.effects.outline.referenceSize).toBeGreaterThan(shrunkWidth);

  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Layers/ }).click();
  await page
    .getByRole("button", { name: /Select .* layer/ })
    .first()
    .click();
  await page.getByRole("tab", { name: /Design/ }).click();
  await expect
    .poll(async () => Number(await page.getByLabel("Width", { exact: true }).last().inputValue()))
    .toBeLessThan(4);
});

test("background selector offers transparent and wiki backgrounds", async ({ page }) => {
  await resetStorage(page);
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  const transparent = inspector.getByRole("button", { name: "Use a transparent background" });
  await expect(transparent).toHaveAttribute("aria-pressed", "true");
  await expect(inspector.getByRole("heading", { name: "Wiki backgrounds" })).toBeVisible();

  const wikiBackground = inspector
    .getByRole("button", { name: /Use .* as the background/ })
    .first();
  await expect(wikiBackground).toBeVisible({ timeout: 20_000 });
  await wikiBackground.click();
  await expect(wikiBackground).toHaveAttribute("aria-pressed", "true");
  await expect(transparent).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("combobox", { name: "Fit" })).toBeVisible();

  await transparent.click();
  await expect(transparent).toHaveAttribute("aria-pressed", "true");
});

test("blocks export and explains when artwork cannot be decoded", async ({ page }) => {
  await resetStorage(page);
  await page.route("**/api/asset-proxy*", (route) => route.abort());
  await page.getByLabel("Search artwork").fill("yum heart");
  const yum = page.getByRole("button", { name: /Add .*Yum Heart.* to canvas/ }).first();
  await expect(yum).toBeVisible({ timeout: 20_000 });
  await yum.click();
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Export PNG" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Export PNG" }).click();
  await expect(dialog.getByText("Some artwork is missing or unavailable")).toBeVisible();
  await expect(dialog.getByText(/Retry images/)).toBeVisible();
  await expect(dialog.getByText("Export complete")).toBeHidden();
});

test("searches the verified wiki catalog and adds a real file", async ({ page }) => {
  await resetStorage(page);
  await page.getByLabel("Search artwork").fill("yum heart");
  const yum = page.getByRole("button", { name: /Add .*Yum Heart.* to canvas/ }).first();
  await expect(yum).toBeVisible({ timeout: 20_000 });
  await yum.click();
  await page.getByRole("tab", { name: /Layers/ }).click();
  await expect(page.getByRole("button", { name: /Select Yum Heart layer/ })).toBeVisible();
  await page.getByRole("tab", { name: /Design/ }).click();
  await expect(page.getByText("IN COPYRIGHT", { exact: true })).toBeVisible();
});

test("mobile layout uses sheets and keeps the canvas usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await resetStorage(page);

  const mobileNav = page.getByRole("navigation", { name: "Editor panels" });
  await expect(mobileNav).toBeVisible();

  await mobileNav.getByRole("button", { name: "Artwork" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Characters", exact: true }).click();
  const character = page.getByRole("button", { name: /Add .*Character/ }).first();
  await expect(character).toBeVisible({ timeout: 20_000 });
  await character.click();
  await page.getByRole("button", { name: "Close panel" }).click();

  await mobileNav.getByRole("button", { name: "Layers" }).click();
  await expect(page.getByRole("button", { name: /Select .* layer/ }).last()).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();

  await expect(page.locator("[role='application']")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("mobile.png"), fullPage: false });
});
