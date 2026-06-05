const DiceRoll = (function() {
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
