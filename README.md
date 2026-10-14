# ORION TRAIL

*Earth is dead. Space wants you dead too. Good luck.*

An Oregon Trail-style space survival game. One HTML file, no server, no build step.

## Play

Open `orion-trail.html` in any browser (double-click works — it runs from `file://`).
To host it, serve `orion-trail.html` and the `scenarios/` folder side by side from any static web root — no server code, no build.

**Phones and tablets:** every key has a tap. Below 900 px the panels stack and the action bar sticks to the bottom;
portrait tablets get two columns; touch tablets in landscape get big tap targets. Every text field (vessel name, each crew member)
has a 🎲 random button, plus RANDOMIZE ALL CREW, so a whole voyage can be set up without a keyboard.

- **[SPACE]** advances one day. The crew burns oxygen, water, and food; the ship burns power and fuel.
- Events strike en route. Every choice trades something for something else. There are no free lunches; there is barely lunch.
- **[R]** repair a system (2 parts + 1 day) · **[T]** treat crew (2 meds) · **[E]** EVA hull patch (3 parts) · **[Z]** rest · **[P]** pace · **[F]** rations · **[S]** status.
- Damaged systems bite: broken life support burns air faster, dead sensors hide incoming trouble, a failing hull leaks cargo, bad astrogation gets you lost, no weapons means no fighting back.
- The route: Earth Orbit → Luna → Mars → Ceres → Europa → Titan → Kuiper → Deep Relay → three candidate planets. The last one will take you. Reaching it is the hard part.
- Progress autosaves to localStorage after every day.

## Repo layout

```
orion-trail.html      engine + UI + CSS. Everything except scenario data.
scenarios/*.js        the scenario library, 19 themed files (227 scenarios)
tools/validate.js     schema + balance checker: node tools/validate.js
misc/SESSION_LOG.md   build history
```

## Authoring scenarios

Scenario data files are plain JS loaded via `<script>` tags. Each file calls
`SCENARIOS.push({...}, {...})`. To add content, edit a category file and reload —
then run `node tools/validate.js`.

### Canonical keys (use ONLY these)

- **Resources:** `oxygen water food power fuel parts meds crew`
- **Systems:** `morale engines generator lifeSupport sensors hull astrogation weapons`
  (the "Crew" ship system is called `morale` in data; `crew` is headcount)
- **Zones:** `inner belt outer deep` — plus `adrift` for the out-of-fuel rescue pool
- **Waypoint ids:** `luna mars ceres europa titan kuiper relay` (candidate planets
  `gliese tauceti kepler` are engine-handled surveys — no set-pieces needed)

### Schema

```js
{
  id: "mech-004",              // "<prefix>-<num>", unique game-wide
  title: "Coolant Loop Rupture",
  category: "mechanical",      // matches the file it lives in
  text: "…",                   // ≤60 words. Second person, present tense, dry gallows humor.
  weight: 1,                   // optional; selection frequency. wildcards use 0.3
  zones: ["belt","outer"],     // optional; omit = all zones. OR waypoint: "mars" for set-pieces
  once: true,                  // default true; false = repeatable (traders, adrift)
  sensorWarning: "…",          // optional; shown 1 day early if sensors NOMINAL
  requires: {                  // optional trigger gates, all ANDed
    systemDamaged: ["sensors"], systemOk: [], resourceBelow: {fuel: 40},
    resourceAbove: {crew: 2}, minLeg: 0, maxLeg: 8,
    requiresFlag: "x", forbidsFlag: "y"
  },
  choices: [                   // 2–4 of these
    {
      label: "Send an engineer in now",
      detail: "Fast fix, dangerous heat",   // optional sub-line
      requires: { systemOk: ["weapons"], resources: {parts: 2}, minCrew: 2 }, // unmet ⇒ greyed out
      cost: { parts: -2 },     // optional; always applied on selection
      outcomes: [              // chances MUST sum to 1.0
        { chance: 0.7, text: "…",
          effects: { meds: -1, food: 10 },   // resource deltas (crew: -1 = a named death)
          damage: { engines: -15 },          // system deltas, negative
          repair: { engines: 20 },           // system deltas, positive
          crewDeath: true,                   // random named crew member dies
          delayDays: 3,                      // extra days of drift (burn, no travel)
          flag: "met_smugglers",             // sets a flag for chained scenarios
          endGame: "eaten by space"          // instant loss — use almost never
        }
      ]
    }
  ]
}
```

### Variation tools (engine-supported)

- **Name tokens** in `title`, `text`, choice `label`/`detail` and outcome `text`: `{crew}` (a random living crew member, fixed for the
  whole scenario), `{crew2}` (a different one), `{dead}` (most recent casualty), `{ship}`. If an outcome kills crew in a scenario that
  uses tokens, it kills `{crew}`. Use `requires.resourceAbove.crew: 1` with `{crew}`, `: 2` with `{crew2}`, `requires.minDead: 1` with `{dead}`
  (the validator enforces these).
- **More `requires` gates:** `minDead` `maxDead` `minDay` `maxDay`.
- **`advance: N`** on an outcome (N ≤ 6): jumps the ship N units along the current leg for free — wind at your back. Shows as `DISTANCE +N`.
- **Moods:** `horror` modals go red and flicker, `bizarre` go cyan, `wonders` go gold. Horror is weighted up for shaky crews and the deep leg; wonders double for a broken crew. `wonders` is exempt from the no-free-lunch warning on purpose.
- **`surveyBonus: 0.1`** on an outcome: raises the habitability odds on the candidate-planet surveys (capped at +0.30 total).
- **Flag chains:** `echoes.js` pays off earlier choices. The validator errors if a scenario consumes a flag nothing sets and warns on dead-end flags.
- **Anti-repeat:** the same category twice in a row is weighted ×0.35. **Quiet days** sometimes log a flavour line (`AMBIENT` in the engine).

### House rules (validator-enforced where possible)

1. **Every choice has a downside** — a guaranteed cost, a bad branch of ≥20% chance,
   or a clear opportunity cost vs. its siblings. No risk-free all-upside options.
2. **Magnitudes:** minor ±5–10 · significant ±15–25 · brutal ±30–50.
   System damage in chunks of 10–40.
3. **Text:** under ~60 words, second person, present tense. Grim, dry, funny at the
   crew's expense, never at the player's intelligence.
4. **crewDeath** is expensive drama — a few per category at most, never at
   chance ≥ 0.5 on an obviously-correct choice.
5. Only consume flags your own file sets.

Run `node tools/validate.js` — it checks ids, keys, chance sums, no-free-lunch,
and pairwise choice dominance, and prints a per-category resource-drain report.

## Balance testing

Open the game, then in the browser console:

```js
OrionDebug.autoplay(500, 'random')       // careless play — target 10–20% survival (officer)
OrionDebug.autoplay(200, 'greedy-safe')  // careful play — target 45–60% survival
OrionDebug.forceScenario('mech-001')     // trigger any scenario by id
OrionDebug.giveResources()               // cheat, for testing endings
OrionDebug.damageSystem('hull', 80)
OrionDebug.skipToLeg(7)                  // jump near the candidate planets
```
