import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { success, failure, wrapHandler } from "../src/lib/errors.js";
import {
  extractTextFromHtml,
  extractTitleFromHtml,
  extractMetaDescription,
} from "../src/lib/html-extractor.js";

describe("error utilities", () => {
  test("success returns content array with text", () => {
    const result = success("hello");
    assert.equal(result.content[0].type, "text");
    assert.equal(result.content[0].text, "hello");
    assert.equal(result.isError, undefined);
  });

  test("failure returns isError flag", () => {
    const result = failure({ code: "TEST", message: "failed" });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /TEST/);
  });

  test("wrapHandler catches errors and returns failure", async () => {
    const handler = wrapHandler(async () => {
      throw new Error("boom");
    });
    const result = await handler({});
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /boom/);
  });

  test("wrapHandler passes through success", async () => {
    const handler = wrapHandler(async () => "ok");
    const result = await handler({});
    assert.equal(result.content[0].text, "ok");
    assert.equal(result.isError, undefined);
  });
});

describe("html-extractor: extractTextFromHtml", () => {
  test("extracts text from simple HTML", () => {
    const html = "<p>Hello World</p>";
    const text = extractTextFromHtml(html);
    assert.equal(text, "Hello World");
  });

  test("removes script tags", () => {
    const html = "<p>Content</p><script>alert('xss')</script><p>More</p>";
    const text = extractTextFromHtml(html);
    assert.ok(!text.includes("alert"));
    assert.ok(!text.includes("script"));
    assert.ok(text.includes("Content"));
    assert.ok(text.includes("More"));
  });

  test("removes style tags", () => {
    const html = "<style>body { color: red; }</style><p>Content</p>";
    const text = extractTextFromHtml(html);
    assert.ok(!text.includes("color"));
    assert.ok(!text.includes("style"));
    assert.ok(text.includes("Content"));
  });

  test("removes head section", () => {
    const html = "<html><head><title>Test</title><meta name=\"x\" content=\"y\"></head><body><p>Body</p></body></html>";
    const text = extractTextFromHtml(html);
    assert.ok(!text.includes("Test"));
    assert.ok(text.includes("Body"));
  });

  test("removes HTML comments", () => {
    const html = "<!-- secret comment --><p>Content</p>";
    const text = extractTextFromHtml(html);
    assert.ok(!text.includes("secret"));
    assert.ok(text.includes("Content"));
  });

  test("preserves line breaks for block elements", () => {
    const html = "<p>Line 1</p><p>Line 2</p><p>Line 3</p>";
    const text = extractTextFromHtml(html);
    assert.ok(text.includes("Line 1"));
    assert.ok(text.includes("Line 2"));
    assert.ok(text.includes("Line 3"));
    // Each paragraph should be on a separate line
    const lines = text.split("\n");
    assert.ok(lines.length >= 3);
  });

  test("decodes HTML entities", () => {
    const html = "<p>&amp;&lt;&gt;&quot;&#39;&nbsp;</p>";
    const text = extractTextFromHtml(html);
    assert.ok(text.includes("&"));
    assert.ok(text.includes("<"));
    assert.ok(text.includes(">"));
    assert.ok(text.includes('"'));
    assert.ok(text.includes("'"));
  });

  test("truncates to max length", () => {
    const longText = "A".repeat(1000);
    const html = `<p>${longText}</p>`;
    const text = extractTextFromHtml(html, 100);
    assert.ok(text.length <= 120); // Allow for truncation suffix
    assert.ok(text.includes("[truncated]"));
  });

  test("handles empty HTML", () => {
    const text = extractTextFromHtml("");
    assert.equal(text, "");
  });

  test("handles nested tags", () => {
    const html = "<div><div><p>Nested content</p></div></div>";
    const text = extractTextFromHtml(html);
    assert.ok(text.includes("Nested content"));
  });

  test("removes iframe tags", () => {
    const html = "<p>Content</p><iframe src=\"evil.com\"></iframe><p>More</p>";
    const text = extractTextFromHtml(html);
    assert.ok(!text.includes("evil.com"));
    assert.ok(text.includes("Content"));
  });

  test("removes svg tags", () => {
    const html = "<p>Content</p><svg><circle r=\"50\"/></svg><p>More</p>";
    const text = extractTextFromHtml(html);
    assert.ok(!text.includes("circle"));
    assert.ok(text.includes("Content"));
  });
});

describe("html-extractor: extractTitleFromHtml", () => {
  test("extracts title", () => {
    const html = "<html><head><title>My Page Title</title></head><body></body></html>";
    assert.equal(extractTitleFromHtml(html), "My Page Title");
  });

  test("returns null when no title", () => {
    const html = "<html><body>No title here</body></html>";
    assert.equal(extractTitleFromHtml(html), null);
  });

  test("decodes entities in title", () => {
    const html = "<title>Test &amp; Demo</title>";
    assert.equal(extractTitleFromHtml(html), "Test & Demo");
  });
});

describe("html-extractor: extractMetaDescription", () => {
  test("extracts meta description", () => {
    const html = '<meta name="description" content="This is a test page">';
    assert.equal(extractMetaDescription(html), "This is a test page");
  });

  test("extracts og:description as fallback", () => {
    const html = '<meta property="og:description" content="OG description here">';
    assert.equal(extractMetaDescription(html), "OG description here");
  });

  test("returns null when no description", () => {
    const html = "<html><body>No description</body></html>";
    assert.equal(extractMetaDescription(html), null);
  });
});
