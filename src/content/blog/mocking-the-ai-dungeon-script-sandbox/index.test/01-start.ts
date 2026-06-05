import { describe, test } from "node:test";
import assert from "node:assert";

describe("DiceRoll", () => {
  test("true should be true", () => {
    assert.equal(true, true);
  });

  test("true should be truthy", () => {
    assert.ok(true);
  });

  test("math should be mathing", () => {
    assert.equal(1 + 1, 2);
  });
});