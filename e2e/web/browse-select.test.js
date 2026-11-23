/**
 * Selecting many apps in Browse (library-ticking.tsx), as in the library: Ctrl+click and Shift+click, Select in a
 * card's menu, then the bar hides them from Browse (with Undo) or adds them to the library.
 */
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { openApp, stop } from "./app.js";

const state = { settings: {}, library: [] };
let s, page;

before(async () => {
  s = await openApp({ state });
  ({ page } = s);
});

beforeEach(async () => {
  await page.reload();
  await page.getByRole("button", { name: "Browse", exact: true }).click();
  await card("tampered-port").first().waitFor();
});

after(async () => {
  await s?.close();
  await stop();
});

// Browse's grid, not the shelves over it, which show some of the same apps.
const card = (slug) => page.locator(`article[data-tick][data-slug="${slug}"]`);
const ticked = () => page.$$eval("article[data-tick][data-ticked]", (els) => els.map((el) => el.dataset.slug));
const bar = () => page.getByRole("toolbar", { name: "Selected apps" });
const toast = (text) => page.locator(".toast", { hasText: text });

test("Ctrl+click and Shift+click select Browse's cards, and the bar hides them, which Undo puts back selected", async () => {
  const slugs = await page.$$eval("article[data-tick]", (els) => els.map((el) => el.dataset.slug));
  assert.ok(slugs.length >= 3, slugs.join());
  await card(slugs[0]).locator(".card-open").click({ modifiers: ["Control"] });
  await bar().waitFor();
  assert.match(await bar().innerText(), /1 selected/);
  await card(slugs[2]).locator(".card-open").click({ modifiers: ["Shift"] });
  await s.until(async () => (await ticked()).length === 3);
  assert.deepEqual((await ticked()).sort(), slugs.slice(0, 3).sort());
  // A plain click now unselects, and no app page opens.
  await card(slugs[2]).locator(".card-open").click();
  await s.until(async () => (await ticked()).length === 2);
  assert.equal(await page.locator(".page-layer:not([hidden])").count(), 0, "no app's page opened");

  await bar().getByRole("button", { name: "Hide from Browse" }).click();
  await bar().waitFor({ state: "detached" });
  await toast("2 apps hidden from Browse.").waitFor();
  for (const slug of slugs.slice(0, 2)) await card(slug).waitFor({ state: "detached" });
  await card(slugs[2]).waitFor();

  await toast("2 apps hidden from Browse.").getByRole("button", { name: "Undo" }).click();
  for (const slug of slugs.slice(0, 2)) await card(slug).waitFor();
  await bar().waitFor();
  assert.deepEqual((await ticked()).sort(), slugs.slice(0, 2).sort());
  await page.keyboard.press("Escape");
  await bar().waitFor({ state: "detached" });
  assert.deepEqual(s.errors, []);
});

test("Select in a card's menu starts selecting, and the bar adds them to the library", async () => {
  await card("tampered-port").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Select", exact: true }).click();
  await bar().waitFor();
  await card("test-remake").locator(".card-open").click();
  assert.match(await bar().innerText(), /2 selected/);
  // While selecting, a card's own Get waits.
  assert.equal(await card("test-remake").locator(".card-action").isVisible(), false);

  await bar().getByRole("button", { name: "Add 2 to library" }).click();
  await bar().waitFor({ state: "detached" });
  await toast("2 apps added to your library.").waitFor();
  const count = page.getByRole("button", { name: /^Library/ }).locator(".count");
  await s.until(async () => (await count.innerText()) === "2");
  assert.deepEqual(s.errors, []);
});
