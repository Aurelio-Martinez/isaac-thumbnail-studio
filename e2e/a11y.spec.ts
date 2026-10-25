import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function seriousViolations(page: Page) {
  return new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
    .then((results) =>
      results.violations.filter(
        (violation) => violation.impact === "serious" || violation.impact === "critical",
      ),
    );
}

test("main editor has no serious accessibility violations", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  if (results.violations.length > 0) {
    console.log(
      JSON.stringify(
        results.violations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          help: violation.help,
          nodes: violation.nodes.slice(0, 5).map((node) => node.target),
        })),
        null,
        2,
      ),
    );
  }

  expect(
    results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    ),
  ).toEqual([]);
});

test("export and project dialogs pass the same accessibility scan", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Export PNG" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();

  await page.getByRole("button", { name: "More project actions" }).click();
  await page.getByRole("menuitem", { name: "Project manager…" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});
