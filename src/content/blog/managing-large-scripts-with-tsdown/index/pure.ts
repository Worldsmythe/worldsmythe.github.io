import { parseIndented, parseBoolean, parseList } from "./parse";

const defaultConfig = `\
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
    words: assuredly, confidently, doubtlessly, skillfully
    results: S S S s s s s p
  disadvantage:
    words: clumsily, tentatively, doubtfully, hesitantly, hapzardly
    results: F F F f f f f p`;

function getOrCreateConfigEntry() {
  for (const card of storyCards) {
    if (card.type === "Class" && card.title === "Configure Dice Roll") {
      if (card.entry) {
        return card.entry;
      }
    }
  }
  const newCard = addStoryCard(
    "",
    defaultConfig,
    "Class",
    "Configure Dice Roll",
    "",
    { returnCard: true },
  );

  return newCard.entry ?? defaultConfig;
}

function getConfig() {
  const raw = parseIndented(getOrCreateConfigEntry());
  return {
    enable: parseBoolean(raw.Enable),
    triggers: parseList(raw.Triggers),
    results: raw.Results ?? {},
    defaultResults: raw["Default Results"] ?? "",
    banks: Object.fromEntries(
      Object.entries(raw.Banks ?? {}).map(([name, bank]) => [
        name,
        {
          words: parseList(bank.words),
          results: bank.results,
        },
      ]),
    ),
  };
}


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
        return text + ` [🎲 Dice Roll: ${getRollResult(config, rollTypeResults)}]`;
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
