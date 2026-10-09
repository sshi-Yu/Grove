import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

test("Grove manifest declares a minimal v2 page app", () => {
  assert.equal(manifest.manifestVersion, 2);
  assert.equal(manifest.id, "grove");
  assert.equal(manifest.name, "Grove");
  assert.deepEqual(manifest.capabilities, []);
  assert.equal(manifest.contributes.cards.length, 1);

  const [panel] = manifest.contributes.cards;
  assert.equal(panel.id, "panel");
  assert.equal(panel.route, "/panel.html");
  assert.equal(panel.realization, "page");
  assert.equal(panel.siteNavEntry, true);
  assert.equal(panel.title, "Grove");
  assert.equal(typeof panel.face.image, "string");
  assert.match(panel.face.image, /^assets\//);
  assert.equal(Object.hasOwn(manifest.contributes, "ui"), false);
});
