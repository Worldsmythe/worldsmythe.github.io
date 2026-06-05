const DiceRoll = (function() {
  const attemptWords = ["try", "attempt"];
  const attemptUnion = attemptWords.join("|");
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
