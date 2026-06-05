import { getConfig, type DiceRollConfig } from "./config.ts";

function getDiceRollType(config: DiceRollConfig, text: string): string | null {
  const modifierWords = Object.values(config.banks)
    .flatMap((bank) => bank.words)
    .join("|");
  const modifierToResult = Object.fromEntries(
    Object.values(config.banks).flatMap((bank) =>
      bank.words.map((word) => [word, bank.results]),
    ),
  );
  const attemptRegex = new RegExp(
    `> (You (?:(${modifierWords}) )?(${config.triggers.join("|")})[^.?!\\n]*[.?!]?)`,
    "i",
  );
  const match = text.match(attemptRegex);
  if (match) {
    const modifier = match[2];
    return (modifier ? modifierToResult[modifier] : null) ?? config.defaultResults;
  }
  return null;
}

function getRollResult(config: DiceRollConfig, diceRollType: string): string {
  const results = diceRollType.split(" ");
  const result = results[Math.floor(Math.random() * results.length)] ?? "";
  return config.results[result] ?? "";
}

export default {
  Hooks:{
    Input: (text: string): string => {
      const config = getConfig();
      if (!config.enable) {
        return text;
      }

      const diceRollType = getDiceRollType(config, text);
      if (diceRollType) {
        return text + ` [🎲 Dice Roll: ${getRollResult(config, diceRollType)}]`;
      }
      return text;
    },
    Output: (text: string): string => {
      return text;
    },
    Context: (text: string): string => {
      return text;
    },
  },
};
