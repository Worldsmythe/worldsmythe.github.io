---
title: "Managing Large AI Dungeon Scripts with tsdown"
description: "When AI Dungeon scripts get complex, it's helpful to break them up into smaller files and use tsdown to bundle them together"
pubDate: "June 04 2026"
heroImage: "../../assets/managing-large-scripts-with-tsdown/hero.png"
tags: ["AI Dungeon", "Scripting", "tsdown"]
---

In parts 1 and 2 of this series, we covered [the basics of
scripting](/blog/intro-to-ai-dungeon-scripting) and [how to make scripts
configurable](/blog/script-configuration-with-story-cards). Now, we'll cover how
to manage large scripts with tsdown.

Last part, we saw that scripts can get unweildy quickly, even to the tune of 130
lines. Generally around that point, I like to start breaking the script up
into multiple files. That normally requires some sort of bundling system to
merge the files together.

## The Starting Point

So, as a reminder, here's what we're working with after Part 2:

```javascript title="library.js"
const DiceRoll = (function () {
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
      "Class",
      "Configure Dice Roll",
      "",
      { returnCard: true },
    );
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
      if (
        ["true", "yes", "1", "on", "enabled", "enable"].includes(normalized)
      ) {
        return true;
      }
      if (
        ["false", "no", "0", "off", "disabled", "disable"].includes(normalized)
      ) {
        return false;
      }
      return defaultValue;
    }

    function parseList(value) {
      return (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

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
        if (!config.enable) {
          return text;
        }
        const diceRollType = getDiceRollType(text);
        if (diceRollType) {
          return text + ` [🎲 Dice Roll: ${getRollResult(diceRollType)}]`;
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
})();
```

```javascript title="input.js"
const modifier = ({ text }) => {
  text = DiceRoll.Hooks.Input(text);
  return { text };
};

modifier(text);
```

If you've scrolled past that, you've probably realized the same thing that I
have: that's a lot of code in one spot. It reads fairly okay, flowing from
config defaults to config parsing to the roll logic to the hook. But in
programming, we have the idea of the [Single Responsibility
Principle](https://en.wikipedia.org/wiki/Single_responsibility_principle),
which says that a unit of code should have one job, and do only that job.

To me, code is much easier to read and maintain when it's in multiple files,
and if you ever intend to have an LLM help you write that code, it has similar
limitations.

My script, [FoxTweaks][foxtweaks], has about 20,000 lines of code (though only
about 6,000 are in the published version, and a chunk of that is data for the
name generator). [Inner Self][inner-self] has about 7,000 lines of code. Most
coding AI harnesses will allow an LLM to read about 2,000 lines of code at a
time, max. This means that if you want to have an LLM effectively help you with
a project of that size, you'll need to break it up into smaller chunks.

The biggest benefit I see isn't actually any of these things. It's autocomplete
in my code editor. I can immediately tell if I have a function wrong, or get
suggestions based on what I'm typing, or go jump to the place a function is
declared (in VSCode, that's `Ctrl+Click`).

This is why we'd look for some more involved tools that can produce the output
we need. I've chosen to use TypeScript and tsdown.

## TypeScript and tsdown

In part 1, I mentioned that we were structuring our script the way we were to
help them play nice with other scripts. To do that, we were using what's called
an [IIFE (Immediately Invoked Function
Expression)](https://developer.mozilla.org/en-US/docs/Glossary/IIFE) to wrap our
script. One of the nice things about tsdown is that it allows us to use the
pattern without needing to write the IIFE ourselves.

TypeScript is a set of tools for JavaScript that lets you verify that your code
is going to get inputs and outputs that you'd expect. It's a great way to catch
errors while you're building the script, rather than needing to wait until
you're running it. We'll see several issues that I didn't catch in the previous
post in this one as we install TypeScript.

So, let's make a new project to work in, install TypeScript and tsdown.

```bash
mkdir dice-roll
cd dice-roll
npm init -y
npm pkg set type="module"
npm i -D typescript tsdown
mkdir src
```

Then, I'm going to configure our TypeScript project to use tsdown. Create a
`tsdown.config.ts`. We're going to note our entrypoint (which doesn't exist
yet), that we'd like to use the IIFE format, and that we'd like to name our
export "DiceRoll", just like our old script.

```typescript
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/index.ts"],
  format: "iife",
  outputOptions: {
    name: "DiceRoll",
  },
});
```

Next we'll download the AI Dungeon API type definitions from FoxTweaks. This is
a file you're free to copy and use in your projects, and makes TypeScript aware
of what the AI Dungeon scripting environment looks like. If this command doesn't
work for you, you can download the file manually from [the FoxTweaks
repository][aidts].

```bash
curl https://raw.githubusercontent.com/Worldsmythe/FoxTweaks/54cf86b3f34406a7f4c4293b4dc0267ebdf3d443/src/aidungeon.d.ts -o src/aidungeon.d.ts
```

## Moving Our Script Over

Now, I'm going to copy over the `library.js` into our new project, and call it
`src/index.ts`. This is going to have a bunch of errors that we'll go through
one by one. If you're using a code editor like VSCode, you'll have a lot of
red squiggles under the code. We'll go through piece by piece, but the first
thing I want to do is tame our huge function into something we can work with.

First, I'm going to move all of the validation and config parsing logic into
a new file called `src/parse.ts`. We'll still have red squiggles here, because
we're not using TypeScript yet. I'm also going to `export` each of these
functions, which makes them available for use in other files.

```typescript title="src/parse.ts"
export function parseIndented(text) {
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

export function parseBoolean(value, defaultValue = false) {
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

export function parseList(value) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
```

Then to update our main script to use these functions, we'll import them, and
also remove our IIFE wrapper. This means:

- Replacing our `return {}` statement with `export default {}`
- Removing our IIFE wrapper
- Removing our `DiceRoll` object (which is now just the `export default` statement)

```typescript title="src/index.ts"
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
  );
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

export default {
  Hooks: {
    Input: (text) => {
      if (!config.enable) {
        return text;
      }
      const diceRollType = getDiceRollType(text);
      if (diceRollType) {
        return text + ` [🎲 Dice Roll: ${getRollResult(diceRollType)}]`;
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
```

### Cleanliness Round One

I also like to take this chance to make our script a little more
[pure](https://en.wikipedia.org/wiki/Pure_function) by moving our logic into the
hook properly, so we're not running logic as a side effect of the script and
instead more clearly run it as a part of the hook, and move some constants out
of the functions.

```typescript title="src/index.ts" del={31-47,77-91,93-100,122-126,140,143} ins={3-19,48,101-120,127-131,135,141,144} collapse={22-28,58-75,148-153}
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
      if (card.entry === defaultConfig) {
        return card.entry;
      }
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

function getDiceRollType(text) {
  const match = text.match(attemptRegex);
  if (match) {
    const modifier = match[2];
    return modifier ? modifierToResult[modifier] : normalResult;
  }
  return null;
}
function getDiceRollType(config, text) {
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

function getRollResult(diceRollType) {
  const results = diceRollType.split(" ");
  const result = Math.floor(Math.random() * results.length);
  return resultTypes[results[result]];
}
function getRollResult(config, diceRollType) {
  const results = diceRollType.split(" ");
  const result = Math.floor(Math.random() * results.length);
  return config.results[results[result]];
}

export default {
  Input: (text) => {
    const config = getConfig();
    if (!config.enable) {
      return text;
    }

    const diceRollType = getDiceRollType(text);
    const diceRollType = getDiceRollType(config, text);
    if (diceRollType) {
      return text + ` [🎲 Dice Roll: ${getRollResult(diceRollType)}]`;
      return text + ` [🎲 Dice Roll: ${getRollResult(config, diceRollType)}]`;
    }
    return text;
  },
  Output: (text) => {
    return text;
  },
  Context: (text) => {
    return text;
  },
};
```

### Cleanliness Round Two

Now I'm seeing another pattern in our main file that I'd like to adjust. We have
a couple config related functions, and then a couple dice roll related
functions. Our original goal was to follow the Single Responsibility Principle,
so we probably should split those out. Let's make another file and copy the
config-related stuff to it. Then we'll import it into our main file.


```typescript title="src/index.ts" del={2-59} ins={1} collapse={61-107} focus={1-59}
import { getConfig } from "./config";
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
      if (card.entry === defaultConfig) {
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

function getDiceRollType(config, text) {
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

function getRollResult(config, diceRollType) {
  const results = diceRollType.split(" ");
  const result = Math.floor(Math.random() * results.length);
  return config.results[results[result]];
}

export default {
  Input: (text) => {
    const config = getConfig();
    if (!config.enable) {
      return text;
    }

    const diceRollType = getDiceRollType(config, text);
    if (diceRollType) {
      return text + ` [🎲 Dice Roll: ${getRollResult(config, diceRollType)}]`;
    }
    return text;
  },
  Output: (text) => {
    return text;
  },
  Context: (text) => {
    return text;
  },
};
```

```typescript title="src/config.ts"
import { parseIndented, parseBoolean, parseList } from "./parse";

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

function getOrCreateConfigEntry() {
  for (const card of storyCards) {
    if (card.type === "Class" && card.title === "Configure Dice Roll") {
      if (card.entry === defaultConfig) {
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

export function getConfig() {
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
```

That's a little bit better now. When we want parsing stuff, we look in
`src/parse.ts`. When we want config stuff, we look in `src/config.ts`. When we
want actual script logic, we look in `src/index.ts`.

### Adding Some Types

Okay, that's a lot of broad-stroke changes. Let's go through and fix some of the
red squiggles. First, I'm going to add some type annotations to our functions,
starting in our parsers. That top little bit is the most important, it's
reflecting that our parser can return either a string or a section. The others
just make sure we have the right constraints on our other functions:

```typescript title="src/parse.ts" ins={1-5,8,10,12,38,53} del={7,9,11,37,52} focus={1-12,37-38,52-53} collapse={15-34,40-50,55-58}
export type ConfigValue = string | ConfigSection;

export interface ConfigSection {
  [key: string]: ConfigValue;
}

export function parseIndented(text: string) {
export function parseIndented(text: string): ConfigSection {
  const root = {};
  const root: ConfigSection = {};
  const stack = [
  const stack: { indent: number; node: ConfigSection }[] = [
    { indent: -1, node: root },
  ];
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

export function parseBoolean(value, defaultValue = false) {
export function parseBoolean(value: string | null, defaultValue = false): boolean {
  if (value == null) {
    return defaultValue;
  }
  const normalized = value.toLowerCase();
  if (["true", "yes", "1", "on", "enabled", "enable"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "0", "off", "disabled", "disable"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

export function parseList(value) {
export function parseList(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
```

This should fix most of our red squiggles in our parser file, and shows some of
the power of TypeScript, where we can use the type annotations to say that we
are expecting certain input and outputs from each function.

Now for `config.ts`, where we add an interface describing the config, and add
types to the two functions:

```typescript title="src/config.ts" ins={3-9,30,50} del={29,49} focus={3-9,29-30,49-50} collapse={11-27,31-47,52-66}
import { parseIndented, parseBoolean, parseList } from "./parse";

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

function getOrCreateConfigEntry() {
function getOrCreateConfigEntry(): string {
  for (const card of storyCards) {
    if (card.type === "Class" && card.title === "Configure Dice Roll") {
      if (card.entry === defaultConfig) {
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

export function getConfig() {
export function getConfig(): DiceRollConfig {
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
```

Then `src/index.ts` imports the config type and adds types to its functions:

```typescript title="src/index.ts" ins={2,5,27,35,48,52} del={1,4,26,34,47,51} focus={1-2,4-5,26-27,34-35,47-48,51-52} collapse={6-23,28-30,36-45}
import { getConfig } from "./config";
import { getConfig, type DiceRollConfig } from "./config";

function getDiceRollType(config, text) {
function getDiceRollType(config: DiceRollConfig, text: string): string | null {
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

function getRollResult(config, diceRollType) {
function getRollResult(config: DiceRollConfig, diceRollType: string): string {
  const results = diceRollType.split(" ");
  const result = Math.floor(Math.random() * results.length);
  return config.results[results[result]];
}

export default {
  Input: (text) => {
  Input: (text: string): string => {
    const config = getConfig();
    if (!config.enable) {
      return text;
    }

    const diceRollType = getDiceRollType(config, text);
    if (diceRollType) {
      return text + ` [🎲 Dice Roll: ${getRollResult(config, diceRollType)}]`;
    }
    return text;
  },
  Output: (text) => {
  Output: (text: string): string => {
    return text;
  },
  Context: (text) => {
  Context: (text: string): string => {
    return text;
  },
};
```

### Fixing Our Config Parsing

Looking good for the most part, except that our config parsing is still
complaining. That might seem annoying at first, but it's actually catching an
issue here. For example, our old version of the script would have issues if the
user had accidentally removed the `Enable` key from their config, or added an
extra letter to it, or any number of innocent but fatal-for-our-script errors.

Or in other words, the issue at hand is that we don't verify when we're running
the hook that the config is in the right shape, and TypeScript is letting us
know that that's an issue.

We'll need to add some functions in our parser to make sure that the config is
in the right shape. These will check that the config is in the shape we're
expecting it to be, and otherwise return nothing.

```typescript title="src/parse.ts" ins={34-50} focus={34-50} collapse={1-32,52-74}
export type ConfigValue = string | ConfigSection;

export interface ConfigSection {
  [key: string]: ConfigValue;
}

export function parseIndented(text: string): ConfigSection {
  const root: ConfigSection = {};
  const stack: { indent: number; node: ConfigSection }[] = [
    { indent: -1, node: root },
  ];
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
      const child: ConfigSection = {};
      parent[key] = child;
      stack.push({ indent, node: child });
    } else {
      parent[key] = value;
    }
  }
  return root;
}

export function asString(value: ConfigValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export function asSection(value: ConfigValue | undefined): ConfigSection {
  return typeof value === "object" && value !== null ? value : {};
}

export function asStringRecord(
  value: ConfigValue | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, child] of Object.entries(asSection(value))) {
    if (typeof child === "string") out[key] = child;
  }
  return out;
}

export function parseBoolean(
  value: string | null,
  defaultValue = false,
): boolean {
  if (value == null) {
    return defaultValue;
  }
  const normalized = value.toLowerCase();
  if (["true", "yes", "1", "on", "enabled", "enable"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "0", "off", "disabled", "disable"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

export function parseList(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
```

We'll use them in `src/config.ts` like so:

```typescript title="src/config.ts" del={1,58-72} ins={2-9,73-92} focus={1-9,58-92} collapse={11-54}
import { parseIndented, parseBoolean, parseList } from "./parse";
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
      if (card.entry === defaultConfig) {
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
```

## Building Our Script

Now that all of our red squiggles are gone, we can build our script. AI
Dungeon can't execute TypeScript directly, so we'll need to compile it to
JavaScript.

```bash
npx tsdown
```

If you take a look in the `dist` directory, you'll find a `index.iife.js` file
in there. Opening it up, it looks basically like the script we've been working
on last time, with the additions and adjustments we've made, but with none of
the type information attached anymore. That file is now ready to be copied into
AI Dungeon's library tab.

You might be asking, "What's the point of all this, then?". Well, we've gained
a couple benefits already:

- We found an issue earlier with how our config parsing worked when users
  edited their config into a bad state.
- We gained the ability to use multiple files in our script.
- We get much better autocomplete in our editors.

### Assessing Our Goal

At the beginning of this article, our goal was to organize our script a little
bit more, and make sure we're able to follow the Single Responsibility
Principle. Have we achieved that?

We've gone from a single file with 150 lines to three files with 55, 74, and 93
lines in each of `index`, `parse`, and `config`. So we have more code overall,
but a good portion of that is fixing up the logical issue we discovered with
TypeScript, and the other few additions are the imports and types we've
declared.

Was it worth it? I'd say so. We don't have to keep the whole script in our head
anymore to work with it, we've fixed up some issues, and we don't have to 
hand-write the wrapper anymore. And as a bonus, most of these fit on one screen,
at least on my monitor, so I'm counting that as a win, too.

Let's take a look at where we ended up.

## Final State

### `parse.ts`

```typescript title="src/parse.ts"
export type ConfigValue = string | ConfigSection;

export interface ConfigSection {
  [key: string]: ConfigValue;
}

export function parseIndented(text: string): ConfigSection {
  const root: ConfigSection = {};
  const stack: { indent: number; node: ConfigSection }[] = [
    { indent: -1, node: root },
  ];
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

export function asString(value: ConfigValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export function asSection(value: ConfigValue | undefined): ConfigSection {
  return typeof value === "object" && value !== null ? value : {};
}

export function asStringRecord(value: ConfigValue | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, child] of Object.entries(asSection(value))) {
    if (typeof child === "string") out[key] = child;
  }
  return out;
}

export function parseBoolean(value: string | null, defaultValue = false): boolean {
  if (value == null) {
    return defaultValue;
  }
  const normalized = value.toLowerCase();
  if (["true", "yes", "1", "on", "enabled", "enable"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "0", "off", "disabled", "disable"].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

export function parseList(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
```

### `config.ts`

```typescript title="src/config.ts"
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
      if (card.entry === defaultConfig) {
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
```

### `index.ts`

```typescript title="src/index.ts"
import { getConfig, type DiceRollConfig } from "./config";

function getDiceRollType(config: DiceRollConfig, text: string): string | null {
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

function getRollResult(config: DiceRollConfig, diceRollType: string): string {
  const results = diceRollType.split(" ");
  const result = Math.floor(Math.random() * results.length);
  return config.results[results[result]];
}

export default {
  Input: (text: string): string => {
    const config = getConfig();
    if (!config.enable) {
      return text;
    }

    const diceRollType = getDiceRollType(config, text);
    if (diceRollType) {
      return text + ` [🎲 Dice Roll: ${getRollResult(config, diceRollType)}]`;
    }
    return text;
  },
  Output: (text: string): string => {
    return text;
  },
  Context: (text: string): string => {
    return text;
  },
};

```

## Conclusion

There's one more benefit to having a project setup like this that I haven't
mentioned yet, and that's the ability to run tests on your scripts without
needing to upload them to AI Dungeon. This is super powerful, because it means
you don't have to wait for AI responses to test your code, and you don't have to
re-paste your code into AI Dungeon every time to test it.

I'll talk more about that in the next part of this series.

As always, if this was useful to you please let me know! I'm `worldsmythe_` on
the [AI Dungeon Discord](https://discord.com/invite/HB2YBZYjyf).


[foxtweaks]: https://github.com/Worldsmythe/FoxTweaks
[inner-self]: https://github.com/LewdLeah/InnerSelf
[aidts]: https://github.com/Worldsmythe/FoxTweaks/blob/54cf86b3f34406a7f4c4293b4dc0267ebdf3d443/src/aidungeon.d.ts
