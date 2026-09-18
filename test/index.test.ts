import { test, expect, beforeEach, afterEach } from "bun:test";
import { upsertSymbol, listSymbols, removeSymbol, svgToSymbolBlock } from "../src/index.js";
import { unlink, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const TEST_SPRITE = "test/fixtures/icons.svg";

beforeEach(async () => {
  if (existsSync(TEST_SPRITE)) {
    await unlink(TEST_SPRITE);
  }
});

afterEach(async () => {
  if (existsSync(TEST_SPRITE)) {
    await unlink(TEST_SPRITE);
  }
});

test("svgToSymbolBlock converts SVG into <symbol>", async () => {
  const rawSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0h24v24H0z"/></svg>`;
  const res = await svgToSymbolBlock(rawSvg, "icon-test", "Test Icon");
  expect(res.viewBox).toBe("0 0 24 24");
  expect(res.block).toContain('<symbol id="icon-test" viewBox="0 0 24 24" fill="none" stroke="currentColor">');
  expect(res.block).toContain('<path d="M0 0h24v24H0z"/>');
  expect(res.block).toContain("<!-- Test Icon -->");
});

test("upsertSymbol creates new sprite and inserts symbol", async () => {
  const rawSvg = `<svg viewBox="0 0 24 24"><path d="M1 1h10v10H1z"/></svg>`;
  const res = await upsertSymbol({
    destFile: TEST_SPRITE,
    symbolId: "icon-square",
    svgContent: rawSvg,
    title: "Square",
  });

  expect(res.action).toBe("inserted");
  expect(res.symbolId).toBe("icon-square");
  expect(existsSync(TEST_SPRITE)).toBe(true);

  const symbols = await listSymbols(TEST_SPRITE);
  expect(symbols).toEqual(["icon-square"]);
});

test("upsertSymbol updates existing symbol", async () => {
  const rawSvg1 = `<svg viewBox="0 0 24 24"><path d="M1 1h10v10H1z"/></svg>`;
  await upsertSymbol({
    destFile: TEST_SPRITE,
    symbolId: "icon-shape",
    svgContent: rawSvg1,
  });

  const rawSvg2 = `<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="10"/></svg>`;
  const res = await upsertSymbol({
    destFile: TEST_SPRITE,
    symbolId: "icon-shape",
    svgContent: rawSvg2,
  });

  expect(res.action).toBe("updated");
  expect(res.viewBox).toBe("0 0 32 32");

  const symbols = await listSymbols(TEST_SPRITE);
  expect(symbols).toEqual(["icon-shape"]);
});

test("upsertSymbol respects bypass flag", async () => {
  const rawSvg1 = `<svg viewBox="0 0 24 24"><path d="M1 1h10v10H1z"/></svg>`;
  await upsertSymbol({
    destFile: TEST_SPRITE,
    symbolId: "icon-shape",
    svgContent: rawSvg1,
  });

  const rawSvg2 = `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="10"/></svg>`;
  const res = await upsertSymbol({
    destFile: TEST_SPRITE,
    symbolId: "icon-shape",
    svgContent: rawSvg2,
    bypass: true,
  });

  expect(res.action).toBe("bypassed");
});

test("removeSymbol deletes an existing symbol", async () => {
  const rawSvg1 = `<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>`;
  const rawSvg2 = `<svg viewBox="0 0 24 24"><path d="M2 2"/></svg>`;

  await upsertSymbol({ destFile: TEST_SPRITE, symbolId: "sym1", svgContent: rawSvg1 });
  await upsertSymbol({ destFile: TEST_SPRITE, symbolId: "sym2", svgContent: rawSvg2 });

  let symbols = await listSymbols(TEST_SPRITE);
  expect(symbols).toEqual(["sym1", "sym2"]);

  const removed = await removeSymbol(TEST_SPRITE, "sym1");
  expect(removed).toBe(true);

  symbols = await listSymbols(TEST_SPRITE);
  expect(symbols).toEqual(["sym2"]);
});
