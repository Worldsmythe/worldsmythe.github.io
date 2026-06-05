import { describe, test } from "node:test";
import assert from "node:assert";
import DiceRoll from "./index.ts";
import { defaultConfig } from "./config.ts";

let nextCardId = 0;

export function testWithAiDungeonEnvironment(
  testName: string,
  testFn: () => void | Promise<void>,
): Promise<void> {
  return test(testName, async () => {
    nextCardId = 0;
    const properties: (keyof typeof globalThis)[] = [
      "storyCards",
      "history",
      "info",
      "state",
      "log",
      "addStoryCard",
      "removeStoryCard",
      "updateStoryCard",
    ];

    const originals = Object.fromEntries(
      properties.map((key) => [key, globalThis[key]]),
    );

    globalThis.storyCards = [];
    globalThis.history = [];
    globalThis.info = {
      actionCount: 0,
      characterNames: [],
    };
    globalThis.state = {
      memory: {},
      message: "",
    };

    globalThis.log = (): void => {
      // Silent in tests
    };

    globalThis.addStoryCard = ((
      keys: string,
      entry?: string,
      type: string = "Custom",
      name?: string,
      description?: string,
      options?: { returnCard: boolean },
    ): StoryCard | number => {
      const card: StoryCard = {
        id: `${nextCardId++}`,
        keys: keys ? [keys] : undefined,
        entry,
        type,
        title: name || keys,
        description: description || "",
      };
      globalThis.storyCards.push(card);

      if (options?.returnCard) {
        return card;
      }
      return globalThis.storyCards.length;
    }) as typeof globalThis.addStoryCard;

    globalThis.removeStoryCard = (index: number): void => {
      const card = globalThis.storyCards[index];
      if (card) {
        globalThis.storyCards.splice(index, 1);
      } else {
        throw new Error(
          `Story card not found at index ${index} in removeStoryCard`,
        );
      }
    };

    globalThis.updateStoryCard = (
      index: number,
      keys: string,
      entry: string,
      type?: string,
      name?: string,
      notes?: string,
    ): void => {
      const existing = globalThis.storyCards[index];
      if (existing) {
        globalThis.storyCards[index] = {
          id: existing.id,
          keys: keys ? [keys] : undefined,
          entry,
          type: type ?? existing.type,
          title: name ?? existing.title,
          description: notes ?? existing.description,
        };
      } else {
        throw new Error(
          `Story card not found at index ${index} in updateStoryCard`,
        );
      }
    };

    try {
      await testFn();
    } finally {
      for (const key of properties) {
        Reflect.deleteProperty(globalThis, key);
        Reflect.set(globalThis, key, originals[key]);
      }
    }
  });
}

describe("DiceRoll", () => {
  describe("Hooks", () => {
    testWithAiDungeonEnvironment("Input should return the input with the dice roll result", () => {
      const result = DiceRoll.Hooks.Input("\n> You try to go to the store.\n");
      assert.match(result, /\[🎲 Dice Roll: .+\]$/);
    });

    testWithAiDungeonEnvironment("Input should return the input when disabled", () => {
      storyCards.push({
        id: `${nextCardId++}`,
        keys: ["enable"],
        entry: defaultConfig.replace("Enable: true", "Enable: false"),
        type: "Class",
        title: "Configure Dice Roll",
        description: "",
      });
      const result = DiceRoll.Hooks.Input("\n> You try to go to the store.\n");
      assert.equal(result, "\n> You try to go to the store.\n");
    });

    testWithAiDungeonEnvironment("Should pull from custom modifier banks", () => {
      for (let i = 0; i < 10; i++) {
        storyCards.push({
          id: `${nextCardId++}`,
          keys: ["advantage"],
          entry: `\
  Enable: true
  Triggers: try, attempt
  Results:
    S: Critical Success!
    s: Success!
    p: Partial Success!
    f: Failure!
    F: Critical Failure!
  Default Results: S s s s s s p p f
  Banks:
    advantage:
      words: surely
      results: S S`,
          type: "Class",
          title: "Configure Dice Roll",
          description: "",
        });
        const result = DiceRoll.Hooks.Input("\n> You surely attempt the lock.\n");
        assert.match(result, /\[🎲 Dice Roll: Critical Success!\]$/, `Result ${i}/10 should be Critical Success!`);
      }
    });

    testWithAiDungeonEnvironment("Should pull from result types and triggers", () => {
      for (let i = 0; i < 10; i++) {
        storyCards.push({
          id: `${nextCardId++}`,
          keys: ["result"],
          entry: `\
Enable: true
Triggers: flip
Results:
  H: Heads!
  T: Tails!
Default Results: H T
  `,
          type: "Class",
          title: "Configure Dice Roll",
          description: "",
        });
        const result = DiceRoll.Hooks.Input("\n> You flip a coin.\n");
        assert.match(result, /\[🎲 Dice Roll: (Heads|Tails)!\]$/, `Result ${i}/10 should be Heads or Tails!`);
      }
    });
  });
});