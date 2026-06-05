import { describe, test } from "node:test";
import assert from "node:assert";
import DiceRoll from "./index.ts";

describe("DiceRoll", () => {
  describe("Hooks", () => {
    test("Input should return the input with the dice roll result", () => {
      const result = DiceRoll.Hooks.Input("\n> You try to go to the store.\n");
      assert.match(result, /\[🎲 Dice Roll: .+\]$/);
    });
  })
});