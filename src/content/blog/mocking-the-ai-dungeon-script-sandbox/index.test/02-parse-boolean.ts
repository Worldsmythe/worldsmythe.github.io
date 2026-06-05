import { describe, test } from "node:test";
import assert from "node:assert";
import { parseBoolean } from "./parse";

describe("DiceRoll", () => {
  describe("parse", () => {
    test("parseBoolean should return true for true", () => {
      assert.equal(parseBoolean("true"), true);
    });
  })
});