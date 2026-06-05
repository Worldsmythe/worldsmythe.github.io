import { parseIndented, parseBoolean, parseList } from "./parse";

function getOrCreateConfigEntry() {
  for (const card of storyCards) {
    if (card.type === "Class" && card.title === "Configure Dice Roll") {
      return card.entry;
    }
  }
  const newCard = addStoryCard(
    "",
    `\
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
    results: F F F f f f f p`,
    "Class", "Configure Dice Roll", "", { returnCard: true });

  return newCard.entry;
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

const config = getConfig();

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

function getRollTypeResults(text) {
  const match = text.match(attemptRegex);
  if (match) {
    const modifier = match[2];
    return modifier ? modifierToResult[modifier] : normalResult;
  }
  return null;
}

function getRollResult(rollTypeResults) {
  const results = rollTypeResults.split(" ");
  const result = Math.floor(Math.random() * results.length);
  return resultTypes[results[result]];
}

export default {
  Hooks: {
    Input: (text) => {
      if (!config.enable) {
        return text;
      }

      const rollTypeResults = getRollTypeResults(text);
      if (rollTypeResults) {
        return text + ` [🎲 Dice Roll: ${getRollResult(rollTypeResults)}]`;
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
