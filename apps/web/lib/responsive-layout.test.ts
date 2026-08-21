import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");

function allMediaBlocks(query: string): string {
  const marker = `@media (${query})`;
  const blocks: string[] = [];
  let from = 0;
  while (from < css.length) {
    const start = css.indexOf(marker, from);
    if (start < 0) break;
    let i = css.indexOf("{", start);
    let depth = 0;
    for (; i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          blocks.push(css.slice(start, i + 1));
          from = i + 1;
          break;
        }
      }
    }
    if (depth !== 0) throw new Error(`unclosed media query ${marker}`);
  }
  expect(blocks.length, `missing media query ${marker}`).toBeGreaterThan(0);
  return blocks.join("\n");
}

function ruleContains(block: string, selector: string, snippet: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\{[^}]*${snippet}`);
  expect(block, `${selector} should include ${snippet}`).toMatch(re);
}

describe("responsive layout contracts", () => {
  it("uses the agreed breakpoints", () => {
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain("@media (min-width: 768px)");
    expect(css).toContain("@media (min-width: 1024px)");
  });

  it("does not mask overflow with a global overflow-x hidden", () => {
    expect(css).not.toMatch(/html\s*,\s*body\s*\{[^}]*overflow-x\s*:\s*hidden/);
    expect(css).not.toMatch(/\.mn-shell\s*\{[^}]*overflow-x\s*:\s*(hidden|clip)/);
  });

  it("keeps public mobile chrome stacked and full-width", () => {
    const mobile = allMediaBlocks("max-width: 767px");
    ruleContains(mobile, ".mn-main-top", "flex-direction:\\s*column");
    ruleContains(mobile, ".mn-mobile-bar", "display:\\s*flex");
    ruleContains(mobile, ".mn-search", "width:\\s*100%");
    ruleContains(mobile, ".mn-search", "max-width:\\s*none");
    ruleContains(mobile, ".mn-sidebar", "position:\\s*fixed");
    ruleContains(mobile, ".mn-sidebar", "transform:\\s*translateX\\(-100%\\)");
    ruleContains(mobile, ".mn-card-grid", "grid-template-columns:\\s*minmax\\(0,\\s*1fr\\)");
    ruleContains(mobile, ".mn-content", "padding:\\s*16px");
  });

  it("keeps admin mobile shell without desktop sidenav reservation", () => {
    const mobile = allMediaBlocks("max-width: 767px");
    ruleContains(mobile, ".side-nav-desktop", "display:\\s*none");
    ruleContains(mobile, ".admin-shell-body", "display:\\s*block");
    ruleContains(mobile, ".admin-shell", "overflow:\\s*visible");
    ruleContains(mobile, ".main-panel", "overflow:\\s*visible");
    ruleContains(mobile, ".main-panel", "padding:\\s*16px");
    ruleContains(mobile, ".admin-toolbar-actions", "flex-direction:\\s*column");
    ruleContains(mobile, ".admin-desktop-only", "display:\\s*none");
    ruleContains(mobile, ".admin-mobile-list", "display:\\s*flex");
    ruleContains(mobile, ".drawer", "width:\\s*min\\(100% - 32px,\\s*560px\\)");
  });

  it("pins admin desktop sidenav while main content scrolls", () => {
    expect(css).toMatch(/\.admin-shell\s*\{[^}]*overflow:\s*hidden/);
    expect(css).toMatch(/\.side-nav-desktop\s*\{[^}]*height:\s*100%/);
    expect(css).toMatch(/\.main-panel\s*\{[^}]*overflow-y:\s*auto/);
  });
});
