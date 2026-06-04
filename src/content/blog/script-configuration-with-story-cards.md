---
title: 'AI Dungeon Script Configuration with Story Cards'
description: 'Let''s make scripts configurable with story cards by extending our dice roll script to support configurable result banks'
pubDate: 'June 03 2026'
heroImage: '../../assets/script-configuration-with-story-cards/hero.png'
tags: ['AI Dungeon', 'Scripting', 'Story Cards']
---

Story cards are a useful way to configure your script's behavior. In the absence
of proper script-defined UI, they're one of the best options for a spot to take
player input, especially because without any keys, Story Cards won't show up in
the context for the AI.

LewdLeah has described story cards as the "least bad workaround for
script-defined UI", which is unfortunately accurate:

> Story cards are the only user-facing text that scripts can both read and
> write. The card entry and notes are strings that the script can template, and
> players can edit them using the normal story card interface.
>
> -- LewdLeah, ["Config Cards: Least Bad Workaround for Script-Defined UI"](https://www.reddit.com/r/AIDungeon/comments/1qqjtlb/config_cards_least_bad_workaround_for/)

I'm sure you've seen them around. Here's what Inner Self's config card looks
like:

:::storycard{type="Class" title="Configure Inner Self" triggers="play.aidungeon.com/profile/LewdLeah"}
> Inner Self grants story characters the ability to learn, plan, and adapt over time. Edit the entry and notes below to control how Inner Self behaves.
> Enable Inner Self: true
> Show detailed guide: false
> First name of player character: "Example"
> Adventure in 1st, 2nd, or 3rd person: 2nd
> Max brain size relative to story context: 30%
> Recent turns searched for name triggers: 5
> Visual indicator of current NPC triggers: "🎭"
> Thought formation chance per turn: 20%
> Half thought chance for Do/Say/Story: true
> Brain card notes store brains as JSON: false
> Enable debug mode to see model tasks: false
> Convert lone em dashes to semicolons: true
> Pin this config card near the top: false
> Install Auto-Cards: true
> Write the name(s) of your non-player characters at the very bottom of the "notes" section below. This is mandatory because it allows Inner Self to assemble independent minds for the correct individuals.
---
> Please visit my profile @LewdLeah through the link above and read my bio for simple steps to add Inner Self to your own scenarios! ❤️

> Inner Self v1.0.2 is an open-source and general-purpose AI Dungeon mod by LewdLeah. You have my full permission to use it with any scenario!

> Write the first name of every intelligent story character on separate lines below, listed from highest to lowest trigger priority:
:::

We can see there are a bunch of different dials that a user can turn by changing
the text in the card:

- `Enable Inner Self`, Whether the script is enabled at all.
- `Thought formation chance per turn`, The chance that a thought will be formed on each turn.
- Which characters are enabled, via the notes section of the card
- `Install Auto-Cards`, even enabling another script via this script's config

Last time, we built a little script that added a dice roll to actions that
start with "try" or "attempt". That might not be catching everything, or might
be catching things that the players of the scenarios don't want it to. Rather
than forcing them to make a new scenario, we can let them configure the script's
behavior. Here's that script for reference.

## The Starting Point

Here's where we left off last time, if you're not following along.

### Library Tab

```javascript title="library.js"
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
```

### Input Tab
```javascript title="input.js"
const modifier = ({ text }) => {
  text = DiceRoll.Hooks.Input(text);
  return { text };
}

modifier(text);
```

## Player and Author Choices

Now, I can think of a couple things that players or scenario authors might want
to configure. I might want a power fantasy where failure is an option, but
success is the most frequent result. I might want players to be able to modify
rolls, so if they try to do something drunkenly, they have bigger odds of
failure. Right now, though, our script is pretty rigid.

:::note[Credit Where Credit's Due]
This script is _heavily_ inspired by PoisonTea's Dice Roll Script ([AI Dungeon
Discord Thread][dice-roll-script]), with the addition of story card
configuration.
:::

PoisonTea's script uses the following words, which I'll be borrowing for the
configurable version of this script:
- Advantage: "assuredly", "confidently", "doubtlessly" and "skillfully"
- Disadvantage: "clumsily", "tentatively", "doubtfully", "hesitantly" and
  "hapzardly"

The way he sets it up, each one triggers a different bank of possible results.
The other alternative is a more complicated system where we assign scores to
each modifier and use that to change the dice roll result. I'm going to go with
configurable result banks because it better illustrates some parts that get
gnarly.

## The Data Structure

I like to start by first making the data structure that I'll use for the
configuration. For me, I'd like to have a list of banks, each with a list of
words and a list of results, as well as the ability to add a new type of
result if desired.

```javascript collapse={23-58} ins={4-22} focus={4-22} title="library.js"
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
      "results": "S S s s s s s p f"
      
    },
    "disadvantage": {
      "words": ["clumsily", "tentatively", "doubtfully", "hesitantly", "hapzardly"],
      "results": "F F f f f f f p s"
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
```

### Using the Data Structure

Now we'll need to modify the script to actually use the new data structure:

```javascript collapse={2-23} ins={25-32,38-41,47-54,70-74,82-85} del={56-68,43-45,34-37,79-81} focus={25-32,38-41,47-54,70-74,82-85} title="library.js"
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
    `> (You (${attemptUnion})[^.?!\\n]*[.?!]?)`, 
    "i"
  );
  const attemptRegex = new RegExp(
    `> (You (?:(${modifierWords}) )?(${attemptUnion})[^.?!\\n]*[.?!]?)`, 
    "i"
  );

  function isDiceRoll(text) {
    return attemptRegex.test(text);
  }

  function getDiceRollType(text) {
    const match = text.match(attemptRegex);
    if (match) {
      const modifier = match[2];
      return modifier ? modifierToResult[modifier] : normalResult;
    }
    return null;
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

  function getRollResult(diceRollType) {
    const results = diceRollType.split(" ");
    const result = Math.floor(Math.random() * results.length);
    return resultTypes[results[result]];
  }

  return {
    Hooks: {
      Input: (text) => { 
        if (isDiceRoll(text)) { 
          return text + ` [🎲 Dice Roll: ${getRollResult()}]`;
        }
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
```

## Designing the Config

So we've got some new features here. We can look for the modifier words in the
input, and if we find one, we'll get the result bank for that modifier word
instead. But that was just the prep work. Instead, we need to actually add the
configuration options. I'd like my card to look like this:

:::storycard{type="Class" title="Configure Dice Roll"}
Enable: true
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
    results: F F F f f f f p
---

:::

So, we have a couple things here. The way I look at these are:

- We have `Enable`, which is a boolean that determines whether the script is
  enabled at all.
 - We have `Results`, which is a section that takes in a dictionary of
  string-string pairs.
- We have `Default Results`, which is a string that represents the default
  results for the dice roll.
- We have `Banks`, which is a section that takes in a dictionary of string-object
  pairs, including a name, `words`, and `results`.


To generify that, we need the ability to:

- Parse in a boolean value
- Parse in a string value
- Pair nesting to create dictionaries
- Handle nested dictionaries
- Pipe the data into our library code when the hook triggers

The `Default Results` is the simplest, so let's take a look at dealing with that
first. Most scripts don't need this nested structure, so this is a good place to
start, too.

## Parsing the Config

Let's get into it. The first thing we'll want to do is deal with the story
card, which involves finding it and getting its contents, or creating it if it
doesn't exist.

```javascript collapse={35-100} focus={2-34} ins={2-34} title="library.js"
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
```

### Parsing Simple Values

Now that we have the config entry, we can start working at parsing it. The
strings are probably the easiest, so let's start with that. I like to create a
config that has the right shape to start with, then parse the values into it
so we don't risk getting unexpected values.

We'll need to create a quick function to parse out a boolean from a string. I've
opted to use these values as `true`:

- `true`
- `yes`
- `1`
- `on`
- `enabled`
- `enable`

And these values as `false`:

- `false`
- `no`
- `0`
- `off`
- `disabled`
- `disable`

`false` tends to be a decent enough fallback, but I'll make it configurable just
for library completeness. I'll also convert the triggers into a list of strings,
splitting on commas and trimming the whitespace.

```javascript focus={32-73} ins={34-72} collapse={2-31,74-139} title="library.js"
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
```

### Parsing Dictionaries

Hardcoding every key like that is a bit ugly, and breaks when you start either
nesting things, or letting users set their own keys. Luckily for us, we're doing
both here!

So I'm going to extract some utilities to help us parse the fundamentals, like
lists and booleans, and run a pass to read the structure of the config entry.
It'll turn something like this:

```text
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
    results: F F F f f f f p
```

Into something like this that our code can use:

```json
{
  "enable": true,
  "triggers": ["try", "attempt"],
  "results": {
    "S": "Critical Success!",
    "s": "Success!",
    "p": "Partial Success!",
    "f": "Failure!",
    "F": "Critical Failure!",
  },
  "defaultResults": "S s s s s s p p f",
  "banks": {
    "advantage": {
      "words": ["assuredly", "confidently", "doubtlessly", "skillfully"],
      "results": "S S S s s s s p"
    },
    "disadvantage": {
      "words": ["clumsily", "tentatively", "doubtfully", "hesitantly", "hapzardly"],
      "results": "F F F f f f f p"
    }
  }
}
```

How does this work? Well, we'll start by treating it like a tree, where the 
root node is the config as a whole, and the children are the keys and values.
Then we'll keep track of a stack of nodes to maintain our indentation context
and level.

For example, if we have this:

```text
Enable: true
Dictionary:
  Child:
    Value: 10
```

We'll start by going through each line, and if we find a key we'll add it to the
current node.

:::trace
```js
root: {},
stack: [
  { indent: -1, node: root }
],
```
```text {1}
Enable: true
Dictionary:
  Child:
    Value: 10
Done: false

```
:::

Then we'll read Enable: true, and add it to the current node:

:::trace
```js
root: {
  "Enable": "true",
}
stack: [
  { indent: -1, node: root }
]
```
```text {2}
Enable: true
Dictionary:
  Child:
    Value: 10
Done: false

```
:::

Then we'll read Dictionary: and add it to the stack, then move to the next line:

:::trace
```js
root: {
  "Enable": "true",
  "Dictionary": {},
}
stack: [
  { indent: -1, node: root }, 
  { indent: 0, node: "Dictionary" }
]
```
```text {3}
Enable: true
Dictionary:
  Child:
    Value: 10
Done: false

```
:::

Same for Child:

:::trace
```js
root: {
  "Enable": "true",
  "Dictionary": {
    "Child": {},
  },
}
stack: [
  { indent: -1, node: root }, 
  { indent: 0, node: "Dictionary" }, 
  { indent: 2, node: "Child" }
]
```
```text {4}
Enable: true
Dictionary:
  Child:
    Value: 10
Done: false

```
:::

And then we'll read Value: 10, and add it to the current node. 

:::trace
```js
root: {
  "Enable": "true",
  "Dictionary": {
    "Child": {
      "Value": "10",
    },
  },
}
stack: [
  { indent: -1, node: root }, 
  { indent: 0, node: "Dictionary" }, 
  { indent: 2, node: "Child" }
]
```
```text {5}
Enable: true
Dictionary:
  Child:
    Value: 10
Done: false

```
:::

We'll then deal with Done, which we'll note is less than our current indentation,
so we'll pop the stack until our indentation is less than or equal to our
current indentation:

:::trace
```js
root: {
  "Enable": "true",
  "Dictionary": {
    "Child": {
      "Value": "10",
    },
  },
  "Done": "true",
}
stack: [
  { indent: -1, node: root }, 
]
```
```text {6}
Enable: true
Dictionary:
  Child:
    Value: 10
Done: false

```
:::

This builds us the _shape_, but doesn't give us the data we want. We'll do a
follow-up pass to convert it into a shape we want, using those utilities we
wrote earlier at the bottom of `getConfig()`, which is really easy because
we already have the structure, we just need to convert the values.

```javascript focus={31-87} ins={31-87} collapse={2-30,88-148} title="library.js"
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
```

That way, our script matches the shape of the card config, which is much more
ergonomic to work with.

## Using the Config

Now, the last step is just to use the config in our script rather than our
hardcoded values, which is pretty straightforward compared to the previous
steps. While we're here, we'll also gate the hook on `config.enable` so that
flipping it off in the card actually turns the script off. Here's what that
looks like:

```javascript del={90-110,114,118,123,132,141} ins={112,115,119,124,133,142,148} focus={90-148} collapse={2-88} title="library.js"
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

  const config = getConfig();

  const modifierWords = Object.values(rollBanks).flatMap(bank => bank.words).join("|");
  const modifierWords = Object.values(config.banks).flatMap(bank => bank.words).join("|");

  const modifierToResult = Object.fromEntries(
    Object.values(rollBanks).flatMap(bank => bank.words.map(word => [word, bank.results]))
    Object.values(config.banks).flatMap(bank => bank.words.map(word => [word, bank.results]))
  );

  const attemptRegex = new RegExp(
    `> (You (?:(${modifierWords}) )?(${attemptUnion})[^.?!\\n]*[.?!]?)`, 
    `> (You (?:(${modifierWords}) )?(${config.triggers.join("|")})[^.?!\\n]*[.?!]?)`, 
    "i"
  );

  function getDiceRollType(text) {
    const match = text.match(attemptRegex);
    if (match) {
      const modifier = match[2];
      return modifier ? modifierToResult[modifier] : normalResult;
      return modifier ? modifierToResult[modifier] : config.defaultResults;
    }
    return null;
  }

  function getRollResult(diceRollType) {
    const results = diceRollType.split(" ");
    const result = Math.floor(Math.random() * results.length);
    return resultTypes[results[result]];
    return config.results[results[result]];
  }

  return {
    Hooks: {
      Input: (text) => { 
        if (!config.enable) { return text; }
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
```

I hope at this point you can see the benefit of starting with a data structure
and building up to the configuration. It's much easier to build a configuration
system like this once you know the constraints of the data structure you're
working with.

## Conclusion

### The Final State

Here's what the final state of the script looks like, for you to peruse:

```javascript title="library.js"
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


  const config = getConfig();

  const modifierWords = Object.values(config.banks).flatMap(bank => bank.words).join("|");
  const modifierToResult = Object.fromEntries(
    Object.values(config.banks).flatMap(bank => bank.words.map(word => [word, bank.results]))
  );

  const attemptRegex = new RegExp(
    `> (You (?:(${modifierWords}) )?(${config.triggers.join("|")})[^.?!\\n]*[.?!]?)`, 
    "i"
  );

  function getDiceRollType(text) {
    const match = text.match(attemptRegex);
    if (match) {
      const modifier = match[2];
      return modifier ? modifierToResult[modifier] : config.defaultResults;
    }
    return null;
  }

  function getRollResult(diceRollType) {
    const results = diceRollType.split(" ");
    const result = Math.floor(Math.random() * results.length);
    return config.results[results[result]];
  }

  return {
    Hooks: {
      Input: (text) => { 
        if (!config.enable) { return text; }
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
```

And our input:

```javascript title="input.js"
const modifier = ({ text }) => {
  text = DiceRoll.Hooks.Input(text);
  return { text };
}

modifier(text);
```

### Long Scripts

One observation you might make is that this script is a bit long, and you'd
be right. 130 lines is a lot, about 3 times as long as the original. But a lot
of these are reusable utilities that we could use in other scripts. The
interesting part is that this is _an order of magnitude_ shorter than some of
the more complex scripts I've seen. Next time, I'll show you how to build out a
project that can help both you and an LLM work better with scripts, and that
can help you stay organized when building a script that gets that complex.

As always, if this was useful to you please let me know! I'm `worldsmythe_` on
the [AI Dungeon Discord](https://discord.com/invite/HB2YBZYjyf).


[dice-roll-script]: https://discord.com/channels/903327676884979802/1400616390389403709/1400616390389403709