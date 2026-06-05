import { getConfig, type DiceRollConfig } from "./config";

function getRollTypeResults(config: DiceRollConfig, text: string): string | null {
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

function getRollResult(config: DiceRollConfig, rollTypeResults: string): string | null {
  const results = rollTypeResults.split(" ");
  const result = results[Math.floor(Math.random() * results.length)] ?? null;
  return config.results[result] ?? null;
}

export default {
  Input: (text: string): string => {
    const config = getConfig();
    if (!config.enable) {
      return text;
    }

    const rollTypeResults = getRollTypeResults(config, text);
    if (rollTypeResults) {
      const rollResult = getRollResult(config, rollTypeResults);
      if (rollResult) {
        return text + ` [🎲 Dice Roll: ${rollResult}]`;
      }
    }
    return text;
  },
  Output: (text: string): string => {
    return text;
  },
  Context: (text: string): string => {
    return text;
  },
};
