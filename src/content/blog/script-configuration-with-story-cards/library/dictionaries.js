const DiceRoll = (function() {
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

  function parseIndented(text) {
    const root = {};
    const stack = [{ indent: -1, node: root }];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const indent = line.length - line.trimStart().length;
      const key = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim();
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1].node;
      if (value === "") {
        const child = {};
        parent[key] = child;
        stack.push({ indent, node: child });
      } else {
        parent[key] = value;
      }
    }
    return root;
  }

  function getConfig() {
    const raw = parseIndented(getOrCreateConfigEntry());

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

    return {
      enable: parseBoolean(raw.Enable),
      triggers: parseList(raw.Triggers),
      results: raw.Results ?? {},
      defaultResults: raw["Default Results"] ?? "",
      banks: Object.fromEntries(
        Object.entries(raw.Banks ?? {}).map(([name, bank]) => [name, {
          words: parseList(bank.words),
          results: bank.results,
        }])
      ),
    };
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

  const modifierWords = Object.values(rollBanks).flatMap(bank => bank.words).join("|");
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
