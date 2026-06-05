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

  const attemptRegex = new RegExp(
    `> (You (${attemptUnion})[^.?!\\n]*[.?!]?)`, 
    "i"
  );

  function isDiceRoll(text) {
    return attemptRegex.test(text);
  }

  function getRollResult() {
    const result = (Math.floor(Math.random() * 20) + 1);
    if (result == 20) {
      return "Critical Success!";
    }
    if (result >= 10) {
      return "Success!";
    }
    if (result >= 5) {
      return "Partial Success!";
    }
    return "Failure!";
  }

  return {
    Hooks: {
      Input: (text) => { 
        log(`was dice roll: ${isDiceRoll(text)}`);
        if (isDiceRoll(text)) { 
          return text + ` [🎲 Dice Roll: ${getRollResult()}]`;
        }
        return text;
      },
      Output: (text) => { return text; },
      Context: (text) => { return text; },
    }
  }
})();
