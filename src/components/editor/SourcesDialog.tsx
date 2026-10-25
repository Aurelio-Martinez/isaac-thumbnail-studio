import { ExternalLink, ShieldCheck } from "lucide-react";
import { APP_CONFIG } from "@/config";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

const SOURCES = [
  {
    name: "The Binding of Isaac: Rebirth Wiki — wiki.gg",
    url: "https://bindingofisaacrebirth.wiki.gg/wiki/Binding_of_Isaac:_Rebirth_Wiki",
    api: "https://bindingofisaacrebirth.wiki.gg/api.php",
    status: "Primary source — verified metadata catalog + live API",
    detail:
      "MediaWiki 1.43.6 Action API verified with origin=* CORS. The studio bundles a metadata-only snapshot of 1,613 unique files (757 collectibles, 247 trinkets, 51 characters, 67 cards, 28 pills, 436 bosses, 27 rooms, 169 active items) so search and browsing work instantly. Each entry stores only the name, dimensions, direct image URL, and source page. Images are never downloaded into the app; they stream live through the allowlisted proxy. A direct live-API source remains selectable.",
    notes:
      "The API exposes no per-file license field in imageinfo extmetadata. Files tagged with Template:License/game are marked IN COPYRIGHT. Cloudflare may challenge automated browsers; use the catalog source or retry in a normal browser.",
  },
  {
    name: "The Binding of Isaac: Rebirth Wiki — Fandom",
    url: "https://bindingofisaacrebirth.fandom.com/wiki/Binding_of_Isaac:_Rebirth_Wiki",
    api: "https://bindingofisaacrebirth.fandom.com/api.php",
    status: "Secondary source — metadata works, images often blocked",
    detail:
      "MediaWiki 1.43.9 Action API verified with origin=* CORS. It exposes the same query, categorymembers, search, and imageinfo shapes. However, the static.wikia.nocookie.net image host applies hotlink protection and returned HTTP 403 to the artwork proxy during verification, so cards could not be composited into a PNG.",
    notes:
      "Only enable Fandom if its image host works for your network. wiki.gg is the recommended source. The app shows a retry action instead of silently exporting a broken image.",
  },
  {
    name: "tboi.com — Isaac Cheat Sheet (Platinum God)",
    url: "https://www.tboi.com/",
    status: "Researched, not integrated",
    detail:
      "A static cheat-sheet site. It serves HTML, CSS, and image files but exposes no documented API, no CORS headers, and no stable machine-readable asset search. Scraping it with CSS selectors would be brittle and outside the site's supported interfaces, so the studio does not use it.",
    notes: "The studio does not bypass access controls, rate limits, or anti-bot protections.",
  },
];

export function SourcesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Artwork sources & licenses"
      description="Where the artwork comes from and what you must check before publishing."
      size="xl"
      footer={
        <Button variant="secondary" size="md" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      }
    >
      <div className="space-y-4 text-[11px] leading-relaxed text-cream-dim">
        <div className="rounded border border-gold/35 bg-gold/5 p-3">
          <p className="flex items-center gap-2 font-semibold text-gold">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Game artwork is copyrighted
          </p>
          <p className="mt-1 text-[10.5px] text-cream-dim">
            Sprites, room screenshots, and boss portraits belong to Nicalis, Inc. and Edmund
            McMillen. The wiki's{" "}
            <code className="rounded bg-ink-900 px-1">Template:License/game</code> marks them{" "}
            <strong className="text-cream">IN COPYRIGHT</strong> (rightsstatements.org InC). The
            studio does not bundle, download, or redistribute these files. It streams a file only
            when you choose it, stores its source URL and attribution in the project, and composites
            it into the PNG you explicitly export.
          </p>
          <p className="mt-2 text-[10.5px] text-cream-dim">
            You are responsible for confirming that your use qualifies as fair use or that you have
            permission. Credit the file page in your video description; a PNG cannot carry metadata.
          </p>
        </div>

        {SOURCES.map((source) => (
          <section key={source.name} className="rounded border border-line p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-[11.5px] font-semibold text-cream">{source.name}</h3>
                <p className="text-[9.5px] uppercase tracking-[0.08em] text-muted">
                  {source.status}
                </p>
              </div>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 text-[10px] text-gold hover:underline"
              >
                Visit source
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
            {source.api ? (
              <p className="mt-2 rounded bg-ink-900 px-2 py-1 font-mono text-[9px] text-muted">
                API: {source.api}
              </p>
            ) : null}
            <p className="mt-2 text-[10.5px]">{source.detail}</p>
            <p className="mt-1.5 text-[10px] text-muted">{source.notes}</p>
          </section>
        ))}

        <section className="rounded border border-line p-3">
          <h3 className="text-[11.5px] font-semibold text-cream">How the importer works</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[10.5px] text-cream-dim">
            <li>
              MediaWiki Action API requests use <code>action=query</code>, <code>format=json</code>,{" "}
              <code>formatversion=2</code>, and <code>origin=*</code> for anonymous cross-origin
              access.
            </li>
            <li>
              <code>prop=imageinfo</code> with <code>iiprop=url|size|mime</code> supplies direct
              URLs, thumbnails, dimensions, and MIME types. <code>iiurlwidth</code> requests
              card-sized previews.
            </li>
            <li>
              Results are cached in memory for ten minutes. Searches are debounced (320 ms) and
              obsolete requests are aborted. Category traversal uses the API's continuation tokens.
            </li>
            <li>
              The catalog is generated with <code>npm run sync:catalog</code>, which queries{" "}
              <code>generator=categorymembers</code> and <code>prop=imageinfo</code> with a 1.2 s
              delay between requests. It stores metadata only — no image files are committed.
            </li>
            <li>
              Remote images are fetched through the same-origin <code>/api/asset-proxy</code>{" "}
              endpoint. It only accepts HTTPS URLs on the two verified wiki hosts with their image
              path prefixes, caps files at 8 MB, times out after 10 seconds, rate-limits callers,
              and adds cache headers. No arbitrary URL proxy exists.
            </li>
            <li>
              A local upload is stored in IndexedDB and never uploaded anywhere. Portable project
              JSON can embed those images so the project can move between browsers.
            </li>
          </ul>
        </section>

        <section className="rounded border border-line p-3">
          <h3 className="text-[11.5px] font-semibold text-cream">Further reading</h3>
          <ul className="mt-1.5 grid gap-1 text-[10.5px] sm:grid-cols-2">
            {[
              ["MediaWiki API", "https://www.mediawiki.org/wiki/API:Main_page"],
              ["Imageinfo", "https://www.mediawiki.org/wiki/API:Imageinfo"],
              ["Cross-site requests", "https://www.mediawiki.org/wiki/API:Cross-site_requests"],
              [
                "wiki.gg license template",
                "https://bindingofisaacrebirth.wiki.gg/wiki/Template:License",
              ],
              ["IN COPYRIGHT", "https://rightsstatements.org/page/InC/1.0/"],
            ].map(([label, href]) => (
              <li key={href}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-cream-dim underline-offset-2 hover:text-gold hover:underline"
                >
                  {label}
                  <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-center text-[9px] uppercase tracking-[0.14em] text-muted-dim">
          {APP_CONFIG.name} · v{APP_CONFIG.version} · verified October 2026
        </p>
      </div>
    </Modal>
  );
}
