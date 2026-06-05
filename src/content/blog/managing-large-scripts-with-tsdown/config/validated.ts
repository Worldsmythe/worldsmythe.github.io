import {
  parseIndented,
  parseBoolean,
  parseList,
  asString,
  asSection,
  asStringRecord,
} from "./parse";

export interface DiceRollConfig {
  enable: boolean;
  triggers: string[];
  results: Record<string, string>;
  defaultResults: string;
  banks: Record<string, { words: string[]; results: string }>;
}

export const defaultConfig = `\
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

function getOrCreateConfigEntry(): string {
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

export function getConfig(): DiceRollConfig {
  const raw = parseIndented(getOrCreateConfigEntry());

  return {
    enable: parseBoolean(asString(raw.Enable)),
    triggers: parseList(asString(raw.Triggers)),
    results: asStringRecord(raw.Results),
    defaultResults: asString(raw["Default Results"]) ?? "",
    banks: Object.fromEntries(
      Object.entries(asSection(raw.Banks)).map(
        ([name, bank]): [string, { words: string[]; results: string }] => {
          const fields = asSection(bank);
          return [
            name,
            {
              words: parseList(asString(fields.words)),
              results: asString(fields.results) ?? "",
            },
          ];
        },
      ),
    ),
  };
}
