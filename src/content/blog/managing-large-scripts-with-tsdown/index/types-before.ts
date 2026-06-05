import { getConfig } from "./config";

function getRollTypeResults(config, text) {
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
    return modifier ? modifierToResult[modifier] : config.defaultResults;
  }
  return null;
}

function getRollResult(config, rollTypeResults) {
  const results = rollTypeResults.split(" ");
  const result = Math.floor(Math.random() * results.length);
  return config.results[results[result]];
}

export default {
  Hooks: {
    Input: (text) => {
      const config = getConfig();
      if (!config.enable) {
        return text;
      }

      const rollTypeResults = getRollTypeResults(config, text);
      if (rollTypeResults) {
        return (
          text + ` [🎲 Dice Roll: ${getRollResult(config, rollTypeResults)}]`
        );
      }
      return text;
    },
    Output: (text) => {
      return text;
    },
    Context: (text) => {
      return text;
    },
  },
};
