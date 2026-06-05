const DiceRoll = (function() {
  function getOrCreateConfigEntry() {
    for (const card of storyCards) {
      if (card.type === "Class" && card.title === "Configure Dice Roll") {
        return card.entry;
      }
    }
    // If the card doesn't exist, create it and use the default config
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
    const entry = getOrCreateConfigEntry();
    const config = {
      enable: false,
      triggers: [],
      results: {},
      defaultResults: "",
      banks: {},
    }

    function parseBoolean(value, defaultValue = false) {
      if (value == null) return defaultValue;
      const normalized = value.toLowerCase();
      if (["true", "yes", "1", "on", "enabled", "enable"].includes(normalized)) {
        return true;
      }
      if (["false", "no", "0", "off", "disabled", "disable"].includes(normalized)) {
        return false;
      }
      return defaultValue;
    }

    function parseList(value) {
      return (value ?? "").split(",").map(item => item.trim()).filter(Boolean);
    }

    for (const line of entry.split("\n")) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const key = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim();
      if (key === "Enable") {
        config.enable = parseBoolean(value);
      } else if (key === "Triggers") {
        config.triggers = parseList(value);
      } else if (key === "Default Results") {
        config.defaultResults = value;
      }
    }

    return config;
  }

  const attemptWords = ["try", "attempt"];
  const attemptUnion = attemptWords.join("|");
  const normalResult = "S s s s s s p p f";
  const resultTypes = {
    "S": "Critical Success!",
    "s": "Success!",
    "p": "Partial Success!",
    "f": "Failure!",
    "F": "Critical Failure!",
  }
  const rollBanks = {
    "advantage": {
      "words": ["assuredly", "confidently", "doubtlessly", "skillfully"],
      "results": "S S S s s s s p"
      
    },
    "disadvantage": {
      "words": ["clumsily", "tentatively", "doubtfully", "hesitantly", "hapzardly"],
      "results": "F F F f f f f p"
    },
  }

  // Get a list of all modifier words for our regex
  const modifierWords = Object.values(rollBanks).flatMap(bank => bank.words).join("|");

  // Get a map of modifier words to their result bank
  // i.e. { "assuredly": "S S S s s s s p" }
  const modifierToResult = Object.fromEntries(
    Object.values(rollBanks).flatMap(bank => bank.words.map(word => [word, bank.results]))
  );

  const attemptRegex = new RegExp(
    `> (You (?:(${modifierWords}) )?(${attemptUnion})[^.?!\\n]*[.?!]?)`, 
    "i"
  );

  function getDiceRollType(text) {
    const match = text.match(attemptRegex);
    if (match) {
      const modifier = match[2];
      return modifier ? modifierToResult[modifier] : normalResult;
    }
    return null;
  }

  function getRollResult(diceRollType) {
    const results = diceRollType.split(" ");
    const result = Math.floor(Math.random() * results.length);
    return resultTypes[results[result]];
  }

  return {
    Hooks: {
      Input: (text) => { 
        const diceRollType = getDiceRollType(text);
        if (diceRollType) { 
          return text + ` [🎲 Dice Roll: ${getRollResult(diceRollType)}]`;
        }
        return text;
      },
      Output: (text) => { return text; },
      Context: (text) => { return text; },
    }
  }
})();
