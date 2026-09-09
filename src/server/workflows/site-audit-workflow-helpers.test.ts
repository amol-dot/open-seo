import { afterEach, describe, expect, it, vi } from "vitest";
import { crawlPage } from "@/server/workflows/site-audit-workflow-helpers";

const HTML = `<!DOCTYPE html><html><head><title>A page title</title></head>
<body><h1>Hi</h1><p>Body text.</p><a href="/next">next</a></body></html>`;

function stubFetch(contentType: string) {
  vi.stubGlobal("fetch", () =>
    Promise.resolve(
      new Response(HTML, {
        status: 200,
        headers: { "content-type": contentType },
      }),
    ),
  );
}

function summarize(page: Awaited<ReturnType<typeof crawlPage>>) {
  return {
    isHtml: page.isHtml,
    title: page.title,
    linkCount: page.links.length,
  };
}

describe("crawlPage content-type classification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // The crawler sends `Accept: text/html,application/xhtml+xml`, and media
  // types are case-insensitive, so both spellings must be analyzed.
  it.each([
    "text/html; charset=utf-8",
    "application/xhtml+xml; charset=utf-8",
    "TEXT/HTML",
  ])("analyzes a page served as %s", async (contentType) => {
    stubFetch(contentType);

    const page = await crawlPage("https://example.com/", 0, false);

    expect(summarize(page)).toEqual({
      isHtml: true,
      title: "A page title",
      linkCount: 1,
    });
  });

  it("records a non-HTML document without analyzing it", async () => {
    stubFetch("application/pdf");

    const page = await crawlPage("https://example.com/doc.pdf", 0, false);

    expect(summarize(page)).toEqual({
      isHtml: false,
      title: "",
      linkCount: 0,
    });
  });
});
