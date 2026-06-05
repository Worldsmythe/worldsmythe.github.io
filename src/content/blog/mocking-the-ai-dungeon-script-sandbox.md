---
title: "Mocking the AI Dungeon Script Sandbox"
description: "Let's test our scripts locally without having to run them in AI Dungeon by building a fake version of the script sandbox"
heroImage: "../../assets/mocking-the-ai-dungeon-script-sandbox/hero.png"
pubDate: "June 05 2026"
tags: ["AI Dungeon", "Scripting", "Sandbox"]
---

In the previous post, we talked about how to manage large scripts with tsdown.
Now, let's talk about how to test our scripts locally without having to run them
in AI Dungeon by building a fake version of the script sandbox. In Software
Engineering, we call this "mocking", which comes from the idea that we're
copying something real and replacing it with a fake version. Like a child on the
playground copying what someone else says until they say "I'm an idiot", then
they respond "You're an idiot" instead.

Personally, I find testing scripts on AI Dungeon a bit tedious, because I have
to build my script, then paste it into AI Dungeon, then build an adventure frame
that makes sense for it, then do the actions that might reproduce the issue I'm
trying to solve. That's a lot of work, and potentially takes time if you're
using a model like Deepseek, which I've seen take 30~60 seconds per turn.

What I do instead is run a couple turns of an adventure in AI Dungeon, and copy
the input / context / output to a file, then use that to test my script locally.

## Project Setup

We're going to need some tools to help us build our fake script sandbox, but
let's look at where we're starting, first.

### The Starting Point

We'll be working in our project from the previous post, a configurable dice roll
script. If you're not following along, here's what our project looks like:

```files
dice-roll
├───src
│   ├───aidungeon.d.ts
│   ├───config.ts
│   ├───index.ts
│   └───parse.ts
├───package.json
└───rolldown.config.ts
```

The main files we're interested in are `index.ts`, which holds our main script
code (_note, these are collapsed by default; expand them if you want to see the
code_):

```ts title="index.ts" src="mocking-the-ai-dungeon-script-sandbox/index/01-start.ts" collapsed
```

Which then imports `config.ts`, which holds our dice roll config:

```ts title="config.ts" src="mocking-the-ai-dungeon-script-sandbox/config/01-start.ts" collapsed
```

Which then imports `parse.ts`, which holds config and value parsing:

```ts title="parse.ts" src="mocking-the-ai-dungeon-script-sandbox/parse/01-start.ts" collapsed
```

### Importing Some Tools

I've been using `node` and `npm` for this project, so we'll keep using those.
Luckily, modern versions of node have a built in test runner and assertions,
along with the ability to run TypeScript code by stripping the types. Let's add
that configuration:

```json title="package.json" before="mocking-the-ai-dungeon-script-sandbox/package/01-start.json" after="mocking-the-ai-dungeon-script-sandbox/package/02-test-script.json"
```

If you were doing this in the past, you might expect that we'd need to add a 
dependency to `jest` or `vitest` or something. But no, we can just use the
built-in test runner, which I think is really cool. No extra tooling or
dependencies.

## Writing a Simple Test

I find it easiest to start by writing a simple test that checks that our setup
works. Let's write a new file that just does some simple assertions.

```ts title="src/index.test.ts" src="mocking-the-ai-dungeon-script-sandbox/index.test/01-start.ts" 
import { describe, test } from "node:test";
import assert from "node:assert";

describe("DiceRoll", () => {
  test("true should be true", () => {
    assert.equal(true, true);
  });

  test("true should be truthy", () => {
    assert.ok(true);
  });

  test("math should be mathing", () => {
    assert.equal(1 + 1, 2);
  });
});
```

Run it, and node's test runner does the rest:

```terminal title="dice-roll"
$ npm test

> dice-roll@1.0.0 test
> node --test

▶ DiceRoll
  ✔ true should be true (0.5715ms)
  ✔ true should be truthy (0.1383ms)
  ✔ math should be mathing (0.1083ms)
✔ DiceRoll (1.6527ms)
ℹ tests 3
ℹ suites 1
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 117.5936
```

### Importing Our Files

Cool, so our test setup works. Now let's try to run a test that tries to parse
a boolean from our parsers:

```ts title="src/index.test.ts" src="mocking-the-ai-dungeon-script-sandbox/index.test/02-parse-boolean.ts" 
```

Now let's run it, and watch it make testing our code locally really easy:

```terminal title="dice-roll"
$ npm run test

> dice-roll@1.0.0 test
> node --test

node:internal/modules/esm/resolve:271
    throw new ERR_MODULE_NOT_FOUND(
          ^

Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\Users\Worldsmythe\dice-roll\src\parse' imported from C:\Users\Worldsmythe\dice-roll\src\index.test.ts
    at finalizeResolution (node:internal/modules/esm/resolve:271:11)
    at moduleResolve (node:internal/modules/esm/resolve:861:10)
    at defaultResolve (node:internal/modules/esm/resolve:988:11)
    at #cachedDefaultResolve (node:internal/modules/esm/loader:697:20)
    at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:714:38)
    at ModuleLoader.resolveSync (node:internal/modules/esm/loader:746:52)
    at #resolve (node:internal/modules/esm/loader:679:17)
    at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:599:35)
    at ModuleJob.syncLink (node:internal/modules/esm/module_job:162:33)
    at ModuleJob.link (node:internal/modules/esm/module_job:252:17) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///C:/Users/Worldsmythe/dice-roll/src/parse'
}

Node.js v24.15.0
✖ src\index.test.ts (80.9932ms)
```

Oh, so something's wrong. We're trying to import the `parse` module, but node
is trying to resolve it from `src/parse.js`. We have `src/parse.ts`, so let's
make that explicit in each of our files:

```ts title="src/index.ts" before="mocking-the-ai-dungeon-script-sandbox/index/01-start.ts" after="mocking-the-ai-dungeon-script-sandbox/index/02-import-ts.ts"
```

```ts title="src/config.ts" before="mocking-the-ai-dungeon-script-sandbox/config/01-start.ts" after="mocking-the-ai-dungeon-script-sandbox/config/02-import-ts.ts"
```

```ts title="src/index.test.ts" before="mocking-the-ai-dungeon-script-sandbox/index.test/02-parse-boolean.ts" after="mocking-the-ai-dungeon-script-sandbox/index.test/03-import-ts.ts"

And give it another try:

```terminal title="dice-roll"
$ npm run test

> dice-roll@1.0.0 test
> node --test

▶ DiceRoll
  ▶ parse
    ✔ parseBoolean should return true for true (0.5638ms)
  ✔ parse (1.2501ms)
✔ DiceRoll (1.6288ms)
ℹ tests 1
ℹ suites 2
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 117.5936
```

Nice. The tests for the parser are pretty straightforward, and what we're really
here to do is build tests that run in an environment similar to AI Dungeon's,
so let's do that next. We'll move our parser tests to `parse.test.ts`, and 
refocus our main test file on the script logic.

### Running a Test With Our Hook

Let's try running a test that runs our hook:

```ts title="src/index.test.ts" src="mocking-the-ai-dungeon-script-sandbox/index.test/04-run-hook.ts" 
```

And run it:

```terminal
$ npm run test

> dice-roll@1.0.0 test
> node --test

▶ DiceRoll
  ▶ Hooks
    ✖ Input should return the input with the dice roll result (0.6398ms)
  ✖ parse (1.2679ms)
✖ DiceRoll (1.6435ms)
ℹ tests 1
ℹ suites 2
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 119.7273

✖ failing tests:

test at src\index.test.ts:7:5
✖ Input should return the input with the dice roll result (0.6398ms)
  ReferenceError: storyCards is not defined
      at getOrCreateConfigEntry (file:///C:/Users/Worldsmythe/dice-roll/src/config.ts:37:22)
      at getConfig (file:///C:/Users/Worldsmythe/dice-roll/src/config.ts:56:29)
      at Object.Input (file:///C:/Users/Worldsmythe/dice-roll/src/index.ts:33:22)
      at TestContext.<anonymous> (file:///C:/Users/Worldsmythe/dice-roll/src/index.test.ts:8:37)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1201:25)
      at Test.start (node:internal/test_runner/test:1096:17)
      at node:internal/test_runner/test:1617:71
      at node:internal/per_context/primordials:466:82
      at new Promise (<anonymous>)
```

Interesting, it looks like we're trying to access `storyCards`, which is not
defined. That probably makes sense, because we're not running in the script
sandbox. This is why we'd need to mock the sandbox environment in our tests.

## Setting Up the Sandbox

I covered the basic things that are included in the script sandbox in my first
post, so I'm going to jump right into implementing them. If you want a
refresher, go read [this
post](/blog/intro-to-ai-dungeon-scripting#global-state).

The basic shape of it looks something like this:

```ts title="src/index.test.ts" src="mocking-the-ai-dungeon-script-sandbox/index.test/05-sandbox-start.ts" 
```

This is a super long function, but it has a couple key parts. First, we're
creating a new test function that will run in our sandbox environment, so
instead of calling `test` directly, we're wrapping `test` in a function that
sets up the environment, aptly called `testWithAiDungeonEnvironment`:

```ts title="src/index.test.ts" src="mocking-the-ai-dungeon-script-sandbox/index.test/05-sandbox-start.ts" focus={07-11,111-112} collapse={1-6,12-108,114-121}
```

Next, we're saving whatever properties we're interested in before we start, and
then restoring them after we're done. 

```ts title="src/index.test.ts" src="mocking-the-ai-dungeon-script-sandbox/index.test/05-sandbox-start.ts" focus={13-26,103-110} collapse={1-12,28-101,114-121}
```

This is mostly for hygiene, so that we're not polluting the global state without
being aware of it.

Finally, we're setting up the sandbox environment to have the same global
helpers as AI Dungeon's, so that our tests are as close to the real thing as
possible:

```ts title="src/index.test.ts" src="mocking-the-ai-dungeon-script-sandbox/index.test/05-sandbox-start.ts" focus={28-101} collapse={1-6,12-26,103-110,113-121}
```

Let's try running our test again with that helper above it:

```terminal title="dice-roll"
$ npm run test

> dice-roll@1.0.0 test
> node --test

▶ DiceRoll
  ▶ Hooks
    ✔ Input should return the input with the dice roll result (1.3482ms)
  ✔ Hooks (1.9422ms)
✔ DiceRoll (2.2864ms)
ℹ tests 1
ℹ suites 2
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 118.27
```

Very nice. That means we can find out in just under a 10th of a second if our
script is going to work, rather than needing to upload it to AI Dungeon, then
run a turn in a scenario which takes seconds at minimum.

### Additional Tests

Now, I'd like to add some additional tests to verify that our config is working
as expected:

- When disabled, the input should return the input unchanged
- Should pull from custom modifier banks
- Should pull from result types and triggers

```ts title="src/index.test.ts" before="mocking-the-ai-dungeon-script-sandbox/index.test/05-sandbox-start.ts" after="mocking-the-ai-dungeon-script-sandbox/index.test/06-additional-tests.ts" 
```

And run it:

```terminal title="dice-roll"
$ npm run test

> dice-roll@1.0.0 test
> node --test

▶ DiceRoll
  ▶ Hooks
    ✔ Input should return the input with the dice roll result (1.3756ms)
    ✔ Input should return the input when disabled (0.2571ms)
    ✔ Should pull from custom modifier banks (1.4018ms)
    ✔ Should pull from result types (0.4803ms)
  ✔ Hooks (4.2244ms)
✔ DiceRoll (4.5721ms)
ℹ tests 4
ℹ suites 2
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 123.1465
```

One of the cool things you can see me doing here is looping a test multiple
times to verify that we haven't just gotten lucky and gotten a random result
that follows what we're expecting. 

## Some Inspiration for Your Own Helpers

There are some helpers that I've written to make working with this easier, like
an array of history messages and types that we can use to fill out the history
before our test runs, or function helpers that produce a config entry for us.
The sky's kind of the limit here. When I found an incompatibility between my
script and Inner Self, I was able to write a test that would mutate the context
like Inner Self does, then run my script, and verify that that class of issues
were never introduced again. I'll include a couple examples here that you're
free to steal from.

This one is a helper that creates a config card for some of FoxTweaks'
intricacies, like using the description rather than the entry to store the
config.

### Config Card Helper

```ts
export function createConfigCard(description: string): StoryCard {
  const length = globalThis.addStoryCard(
    "Configure FoxTweaks behavior",
    "",
    "class"
  );
  // We know addStoryCard returns number in this case (no returnCard option)
  const cardIndex =
    (typeof length === "number" ? length : globalThis.storyCards.length) - 1;
  const card = globalThis.storyCards[cardIndex];
  if (!card) {
    throw new Error("Failed to create config card");
  }
  card.title = "FoxTweaks Config";
  card.description = description;
  return card;
}
```

### Add History Action Helper

This one is a helper that adds a history action to the history array, and 
gives me nice autocomplete for the action types.

```ts
export function addHistoryAction(text: string, type: History["type"]): void {
  globalThis.history.push({ text, type });
}
```

### History Helper

Another one I have is a big chunk of history that I can use to fill out the
history for me (this goes on for several turns), produced by adding 
`log(text)`, `log(JSON.stringify(history))`, and `log(JSON.stringify(state))` to
a scenario in each of the hooks:

```ts
const turns = [
  {
    input: {
      state: {
        placeholders: [],
        memory: {
          context: "### Character\n\nYou are Jace, an adventurer. You are strong, wielding a sword and shield, and have black hair and blue eyes. You travel with Elara, an elven mage with silver hair and violet eyes, and Lyra, a wiry rogue with blonde hair and green eyes.\n\n### Premise\n\nYou're delving a dungeon with Elara and Lyra.",
          authorsNote: ""
        }
      },
      history: [],
      text: "You are an adventurer in a dungeon."
    },
    context: {
      state: {
        placeholders: [],
        memory: {
          context: "### Character\n\nYou are Jace, an adventurer. You are strong, wielding a sword and shield, and have black hair and blue eyes. You travel with Elara, an elven mage with silver hair and violet eyes, and Lyra, a wiry rogue with blonde hair and green eyes.\n\n### Premise\n\nYou're delving a dungeon with Elara and Lyra.",
          authorsNote: ""
        }
      },
      history: [
        {
          text: "You are an adventurer in a dungeon.",
          type: "start",
          rawText: "You are an adventurer in a dungeon."
        }
      ],
      text: "### Character\n\nYou are Jace, an adventurer. You are strong, wielding a sword and shield, and have black hair and blue eyes. You travel with Elara, an elven mage with silver hair and violet eyes, and Lyra, a wiry rogue with blonde hair and green eyes.\n\n### Premise\n\nYou're delving a dungeon with Elara and Lyra.\nYou are an adventurer in a dungeon."
    }
    output: {
      state: {
        placeholders: [],
        memory: {
          context: "### Character\n\nYou are Jace, an adventurer. You are strong, wielding a sword and shield, and have black hair and blue eyes. You travel with Elara, an elven mage with silver hair and violet eyes, and Lyra, a wiry rogue with blonde hair and green eyes.\n\n### Premise\n\nYou're delving a dungeon with Elara and Lyra.",
          authorsNote: ""
        }
      },
      history: [
        {
          text: "You are an adventurer in a dungeon.",
          type: "start",
          rawText: "You are an adventurer in a dungeon."
        }
      ],
      text: " The Dungeon Entrance\n\nThe heavy iron door groans on ancient hinges as you push it open, revealing a dark corridor ahead. The air is cool and damp, smelling of wet stone and something faintly metallic. From your torch, flickering light dances across rough-hewn walls glistening with condensation.\n\nBeside you, Elara adjusts the silver-white braid over her shoulder, her violet eyes narrowed as she peers into the gloom. \"The aura here is… old,\" she murmurs, one hand resting on the smooth wood of her staff. \"There's residual magic, but it's faded. Like an echo.\""
    }
  },
  {
    // Continue action, no input
    input: undefined,
    context: {
      state: {
        placeholders: [],
        memory: {
          context: "### Character\n\nYou are Jace, an adventurer. You are strong, wielding a sword and shield, and have black hair and blue eyes. You travel with Elara, an elven mage with silver hair and violet eyes, and Lyra, a wiry rogue with blonde hair and green eyes.\n\n### Premise\n\nYou're delving a dungeon with Elara and Lyra.",
          authorsNote: ""
        }
      },
      history: [
        {
          text: "The Dungeon Entrance\n\nThe heavy iron door groans on ancient hinges as you push it open, revealing a dark corridor ahead. The air is cool and damp, smelling of wet stone and something faintly metallic. From your torch, flickering light dances across rough-hewn walls glistening with condensation.\n\nBeside you, Elara adjusts the silver-white braid over her shoulder, her violet eyes narrowed as she peers into the gloom. \"The aura here is… old,\" she murmurs, one hand resting on the smooth wood of her staff. \"There's residual magic, but it's faded. Like an echo.\"",
          type: "continue",
          rawText: "The Dungeon Entrance\n\nThe heavy iron door groans on ancient hinges as you push it open, revealing a dark corridor ahead. The air is cool and damp, smelling of wet stone and something faintly metallic. From your torch, flickering light dances across rough-hewn walls glistening with condensation.\n\nBeside you, Elara adjusts the silver-white braid over her shoulder, her violet eyes narrowed as she peers into the gloom. \"The aura here is… old,\" she murmurs, one hand resting on the smooth wood of her staff. \"There's residual magic, but it's faded. Like an echo.\""
        }
      ],
      text: " Lyra leans against the wall, a grin playing on her lips. She tests the edge of one of her daggers with a thumb. \"Old and faded sounds like someone already looted the place. But hey, echoes can be valuable too.\" She pushes off the wall, her leathers creaking softly. \"Shall we see what's making that metallic smell? Could be rust… or something shinier.\" \n\nTorchlight licks the walls, revealing crude carvings worn smooth by time—perhaps depicting robed figures in procession. The corridor stretches ahead into darkness, the floor uneven with settled flagstones. From deep within, a faint, rhythmic dripping echoes."
    },
    output: {
      state: {
        placeholders: [],
        memory: {
          context: "### Character\\n\\nYou are Jace, an adventurer. You are strong, wielding a sword and shield, and have black hair and blue eyes. You travel with Elara, an elven mage with silver hair and violet eyes, and Lyra, a wiry rogue with blonde hair and green eyes.\\n\\n### Premise\\n\\nYou're delving a dungeon with Elara and Lyra.\",\"authorsNote\":\"\"
        }
      },
      history: [
        {
          text: "You are an adventurer in a dungeon.",
          type: "start",
          rawText: "You are an adventurer in a dungeon."
        },
        {
          text: " The Dungeon Entrance\n\nThe heavy iron door groans on ancient hinges as you push it open, revealing a dark corridor ahead. The air is cool and damp, smelling of wet stone and something faintly metallic. From your torch, flickering light dances across rough-hewn walls glistening with condensation.\n\nBeside you, Elara adjusts the silver-white braid over her shoulder, her violet eyes narrowed as she peers into the gloom. \"The aura here is… old,\" she murmurs, one hand resting on the smooth wood of her staff. \"There's residual magic, but it's faded. Like an echo.\"",
          type: "continue",
          rawText: " The Dungeon Entrance\n\nThe heavy iron door groans on ancient hinges as you push it open, revealing a dark corridor ahead. The air is cool and damp, smelling of wet stone and something faintly metallic. From your torch, flickering light dances across rough-hewn walls glistening with condensation.\n\nBeside you, Elara adjusts the silver-white braid over her shoulder, her violet eyes narrowed as she peers into the gloom. \"The aura here is… old,\" she murmurs, one hand resting on the smooth wood of her staff. \"There's residual magic, but it's faded. Like an echo.\""
        },
      ],
      text: " Lyra leans against the wall, a grin playing on her lips. She tests the edge of one of her daggers with a thumb. \"Old and faded sounds like someone already looted the place. But hey, echoes can be valuable too.\" She pushes off the wall, her leathers creaking softly. \"Shall we see what's making that metallic smell? Could be rust… or something shinier.\" \n\nTorchlight licks the walls, revealing crude carvings worn smooth by time—perhaps depicting robed figures in procession. The corridor stretches ahead into darkness, the floor uneven with settled flagstones. From deep within, a faint, rhythmic dripping echoes."
    }
  },
  // Do action
  {
    input: {
      state: {
        placeholders: [],
        memory: {
          context: "### Character\n\nYou are Jace, an adventurer. You are strong, wielding a sword and shield, and have black hair and blue eyes. You travel with Elara, an elven mage with silver hair and violet eyes, and Lyra, a wiry rogue with blonde hair and green eyes.\n\n### Premise\n\nYou're delving a dungeon with Elara and Lyra.",
          authorsNote: ""
        }
      },
      history: [
        {
          text: "You are an adventurer in a dungeon.",
          type: "start",
          rawText: "You are an adventurer in a dungeon."
        },
        {
          text: " The Dungeon Entrance\n\nThe heavy iron door groans on ancient hinges as you push it open, revealing a dark corridor ahead. The air is cool and damp, smelling of wet stone and something faintly metallic. From your torch, flickering light dances across rough-hewn walls glistening with condensation.\n\nBeside you, Elara adjusts the silver-white braid over her shoulder, her violet eyes narrowed as she peers into the gloom. \"The aura here is… old,\" she murmurs, one hand resting on the smooth wood of her staff. \"There's residual magic, but it's faded. Like an echo.\"",
          type: "continue",
          rawText: " The Dungeon Entrance\n\nThe heavy iron door groans on ancient hinges as you push it open, revealing a dark corridor ahead. The air is cool and damp, smelling of wet stone and something faintly metallic. From your torch, flickering light dances across rough-hewn walls glistening with condensation.\n\nBeside you, Elara adjusts the silver-white braid over her shoulder, her violet eyes narrowed as she peers into the gloom. \"The aura here is
        },
        {
          text: " Lyra leans against the wall, a grin playing on her lips. She tests the edge of one of her daggers with a thumb. \"Old and faded sounds like someone already looted the place. But hey, echoes can be valuable too.\" She pushes off the wall, her leathers creaking softly. \"Shall we see what's making that metallic smell? Could be rust… or something shinier.\" \n\nTorchlight licks the walls, revealing crude carvings worn smooth by time—perhaps depicting robed figures in procession.The corridor stretches ahead into darkness, the floor uneven with settled flagstones. From deep within, a faint, rhythmic dripping echoes.",
          type: "continue",
          rawText: " Lyra leans against the wall, a grin playing on her lips. She tests the edge of one of her daggers with a thumb. \"Old and faded sounds like someone already looted the place. But hey, echoes can be valuable too.\" She pushes off the wall, her leathers creaking softly. \"Shall we see what's making that metallicsmell? Could be rust… or something shinier.\" \n\nTorchlight licks the walls, revealing crude carvings worn smooth by time—perhaps depicting robed figures in procession. The corridor stretches ahead into darkness, the floor uneven with settled flagstones. From deep within, a faint, rhythmic dripping echoes."
        }
      ],
      text: "\n> You try to follow the scent.\n"
    },
    context: {
      state: {
        placeholders: [],
        memory: {
          context: "### Character\n\nYou are Jace, an adventurer. You are strong, wielding a sword and shield, and have black hair and blue eyes. You travel with Elara, an elven mage with silver hair and violet eyes, and Lyra, a wiry rogue with blonde hair and green eyes.\n\n### Premise\n\nYou're delving a dungeon with Elara and Lyra.",
          authorsNote: ""
        }
      },
      history: [
        {
          text: "You are an adventurer in a dungeon.",
          type: "start",
          rawText: "You are an adventurer in a dungeon."
        },
        {
          text: " The Dungeon Entrance\n\nThe heavy iron door groans on ancient hinges as you push it open, revealing a dark corridor ahead. The air is cool and damp, smelling of wet stone and something faintly metallic. From your torch, flickering light dances across rough-hewn walls glistening with condensation.\n\nBeside you, Elara adjusts the silver-white braid over her shoulder, her violet eyes narrowed as she peers into the gloom. \"The aura here is… old,\" she murmurs, one hand resting on the smooth wood of her staff. \"There's residual magic, but it's faded. Like an echo.\"",
          type: "continue",
          rawText: " The Dungeon Entrance\n\nThe heavy iron door groans on ancient hinges as you push it open, revealing a dark corridor ahead. The air is cool and damp, smelling of wet stone and something faintly metallic. From your torch, flickering light dances across rough-hewn walls glistening with condensation.\n\nBeside you, Elara adjusts the silver-white braid over her shoulder, her violet eyes narrowed as she peers into the gloom. \"The aura here is… old,\" she murmurs, one hand resting on the smooth wood of her staff. \"There's residual magic, but it's faded. Like an echo.\""
        },
        {
          text: " Lyra leans against the wall, a grin playing on her lips. She tests the edge of one of her daggers with a thumb. \"Old and faded sounds like someone already looted the place. But hey, echoes can be valuable too.\" She pushes off the wall, her leathers creaking softly. \"Shall we see what's making that metallic smell? Could be rust… or something shinier.\" \n\nTorchlight licks the walls, revealing crude carvings worn smooth by time—perhaps depicting robed figures in procession.The corridor stretches ahead into darkness, the floor uneven with settled flagstones. From deep within, a faint, rhythmic dripping echoes.",
          type: "continue",
          rawText: " Lyra leans against the wall, a grin playing on her lips. She tests the edge of one of her daggers with a thumb. \"Old and faded sounds like someone already looted the place. But hey, echoes can be valuable too.\" She pushes off the wall, her leathers creaking softly. \"Shall we see what's making that metallicsmell? Could be rust… or something shinier.\" \n\nTorchlight licks the walls, revealing crude carvings worn smooth by time—perhaps depicting robed figures in procession. The corridor stretches ahead into darkness, the floor uneven with settled flagstones. From deep within, a faint, rhythmic dripping echoes."
        },
        {
          text: "\n> You try to follow the scent.\n",
          type: "do",
          rawText: "\n> You try to follow the scent.\n"
        }
      ],
      text: "### Character\n\nYou are Jace, an adventurer. You are strong, wielding a sword and shield, and have black hair and blue eyes. You travel with Elara, an elven mage with silver hair and violet eyes, and Lyra, a wiry rogue with blonde hair and green eyes.\n\n### Premise\n\nYou're delving a dungeon with Elara and Lyra.\nWorld Lore:\nLyra is a wiry human rogue with blonde hair and green eyes.\n\nElara is an elf with silver hair and violet eyes.\n\nRecent Story:\nYou are an adventurer in a dungeon. The Dungeon Entrance\n\nThe heavy iron door groans on ancient hinges as you push it open, revealing a dark corridor ahead. The air is cool and damp, smelling of wet stone and something faintly metallic. From your torch, flickering light dances across rough-hewn walls glistening with condensation.\n\nBeside you, Elara adjusts the silver-white braid over her shoulder, her violet eyes narrowed as she peers into the gloom. \"The aura here is… old,\" she murmurs, one hand resting on the smooth wood of her staff. \"There's residual magic, but it's faded. Like an echo.\" Lyra leans against the wall, a grin playing on her lips. She tests the edge of one of her daggers with a thumb. \"Old and faded sounds like someone already looted the place. But hey, echoes can be valuable too.\" She pushes off the wall, her leathers creaking softly. \"Shall we see what's making that metallic smell? Could be rust… or something shinier.\" \n\nTorchlight licks the walls, revealing crude carvings wornsmooth by time—perhaps depicting robed figures in procession. The corridor stretches ahead into darkness, the floor uneven with settled flagstones. From deep within, a faint, rhythmic dripping echoes.\n\n> You try to follow the scent.\n"
    },
    output: {
      state: {
        placeholders: [],
        memory: {
          context: "### Character\n\nYou are Jace, an adventurer. You are strong, wielding a sword and shield, and have black hair and blue eyes. You travel with Elara, an elven mage with silver hair and violet eyes, and Lyra, a wiry rogue with blonde hair and green eyes.\n\n### Premise\n\nYou're delving a dungeon with Elara and Lyra.",
          authorsNote: ""
        }
      },
      history: [
        {
          text: "You are an adventurer in a dungeon.",
          type: "start",
          rawText: "You are an adventurer in a dungeon."
        },
        {
          text: " The Dungeon Entrance\n\nThe heavy iron door groans on ancient hinges as you push it open, revealing a dark corridor ahead. The air is cool and damp, smelling of wet stone and something faintly metallic. From your torch, flickering light dances across rough-hewn walls glistening with condensation.\n\nBeside you, Elara adjusts the silver-white braid over her shoulder, her violet eyes narrowed as she peers into the gloom. \"The aura here is… old,\" she murmurs, one hand resting on the smooth wood of her staff. \"There's residual magic, but it's faded. Like an echo.\"",
          type: "continue",
          rawText: " The Dungeon Entrance\n\nThe heavy iron door groans on ancient hinges as you push it open, revealing a dark corridor ahead. The air is cool and damp, smelling of wet stone and something faintly metallic. From your torch, flickering light dances across rough-hewn walls glistening with condensation.\n\nBeside you, Elara adjusts the silver-white braid over her shoulder, her violet eyes narrowed as she peers into the gloom. \"The aura here is… old,\" she murmurs, one hand resting on the smooth wood of her staff. \"There's residual magic, but it's faded. Like an echo.\""
        },
        {
          text: " Lyra leans against the wall, a grin playing on her lips. She tests the edge of one of her daggers with a thumb. \"Old and faded sounds like someone already looted the place. But hey, echoes can be valuable too.\" She pushes off the wall, her leathers creaking softly. \"Shall we see what's making that metallic smell? Could be rust… or something shinier.\" \n\nTorchlight licks the walls, revealing crude carvings worn smooth by time—perhaps depicting robed figures in procession.The corridor stretches ahead into darkness, the floor uneven with settled flagstones. From deep within, a faint, rhythmic dripping echoes.",
          type: "continue",
          rawText: " Lyra leans against the wall, a grin playing on her lips. She tests the edge of one of her daggers with a thumb. \"Old and faded sounds like someone already looted the place. But hey, echoes can be valuable too.\" She pushes off the wall, her leathers creaking softly. \"Shall we see what's making that metallicsmell? Could be rust… or something shinier.\" \n\nTorchlight licks the walls, revealing crude carvings worn smooth by time—perhaps depicting robed figures in procession. The corridor stretches ahead into darkness, the floor uneven with settled flagstones. From deep within, a faint, rhythmic dripping echoes."
        },
        {
          text: "\n> You try to follow the scent.\n",
          type: "do",
          rawText: "\n> You try to follow the scent.\n"
        }
      ],
      text: "You step forward, the torchlight shifting with your movement as you lead the way down the corridor. The metallic scent grows stronger—not the sharp tang of blood, but something heavier, like aged copper or bronze. Your boots scuff against the stone, disturbing a fine layer of dust that puffs up into the torchlight.\n\nElara follows close behind, her staff held loosely but ready. \"Be careful,\" she says softly, her voice carrying in the narrow space. \"Old dungeons have a way of hiding their teeth.\" Lyra is already a few steps ahead of you, peering at the walls. She traces a finger along one of the weathered carvings."
    }
  }
];
```

I have a little helper script that takes in the history strings from the log
copied straight from AI Dungeon and puts them into the JSON format, like this:

```ts title="parseLog.ts"
import { readFileSync } from "node:fs";

interface ModifierFrame {
  state: State;
  history: History[];
  text: string;
}

interface Turn {
  input?: ModifierFrame;
  context: ModifierFrame;
  output: ModifierFrame;
}

interface Section {
  kind: string;
  logs: string[];
}

const HEADER = /^(Input|Context|Output) Modifier @ .+:$/;
const LOG_PREFIX = "Log: ";

function parseStringLog(log: string): string {
  const value: unknown = JSON.parse(log);
  if (typeof value !== "string") {
    throw new Error(`Expected a quoted string log entry, got: ${log}`);
  }
  return value;
}

function toFrame(section: Section): ModifierFrame {
  if (section.logs.length < 3) {
    throw new Error(
      `${section.kind} modifier needs state, history, and text logs, found ${section.logs.length}`,
    );
  }
  const state: State = JSON.parse(parseStringLog(section.logs[0]));
  const history: History[] = JSON.parse(parseStringLog(section.logs[1]));
  const text = parseStringLog(section.logs[2]);
  return { state, history, text };
}

export function parseLog(raw: string): Turn[] {
  const sections: Section[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const header = line.match(HEADER);
    if (header) {
      sections.push({ kind: header[1], logs: [] });
      continue;
    }
    if (line.startsWith(LOG_PREFIX) && sections.length > 0) {
      sections[sections.length - 1].logs.push(line.slice(LOG_PREFIX.length));
    }
  }

  const turns: Turn[] = [];
  let input: ModifierFrame | undefined;
  let context: ModifierFrame | undefined;
  for (const section of sections) {
    const frame = toFrame(section);
    if (section.kind === "Input") {
      input = frame;
    } else if (section.kind === "Context") {
      context = frame;
    } else {
      if (!context) {
        throw new Error("Output modifier with no preceding context modifier");
      }
      turns.push({ input, context, output: frame });
      input = undefined;
      context = undefined;
    }
  }
  return turns;
}

if (import.meta.main) {
  const path = process.argv[2];
  const raw = readFileSync(path ?? 0, "utf8");
  process.stdout.write(`${JSON.stringify(parseLog(raw), null, 2)}\n`);
}
```

Run like:

```terminal
$ node parseLog.ts dump.log
```

## Conclusion

I hope you find this process useful! I've found that it makes me much faster,
and by the time I actually build my project and upload it to AI Dungeon, I tend
to find far fewer issues than if I had just built it in AI Dungeon because I
can verify and iterate much faster.

LLMs can also find this much easier to work with these, since they don't know
the sandbox and scripting API, and this gives them access to that without
needing them to need to control a browser or use the API or something like that
(though if you _do_ want them to use the API, check out my [ai-dungeon
skill](https://github.com/Worldsmythe/skills)!)

As always, if this was useful to you please let me know! I'm `worldsmythe_` on
the [AI Dungeon Discord](https://discord.com/invite/HB2YBZYjyf).
