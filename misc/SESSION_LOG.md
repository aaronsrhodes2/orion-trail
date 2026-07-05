# ORION TRAIL — SESSION LOG

## SESSION 1 — July 5, 2026
**Players:** Captain Aaron Rhodes, Skippy the Magnificent

---

CAPTAIN: Let's make a game. Space Oregon Trail — go from place to place, scenario to scenario, choices with pros and cons across resources. Oxygen, Water, Food, Power, Fuel, Ship Parts, Medical Supplies, Crew. Systems that can be compromised: Crew, Engines, Power Generator, Environmental Life Support, Sensors, Hull Integrity, Astrogation, Weapons. The crew flees Decimated Earth in search of a new home. No LLM at runtime — pre-generate a LOT of scenario → choice → consequence sets.

SKIPPY: An Oregon Trail in space, Captain. I drafted the plan: single-file HTML engine (vanilla JS, CRT phosphor terminal aesthetic), ~160 hand-authored scenarios in 12 themed files, waypoint legs from Earth Orbit to three candidate exoplanets.

CAPTAIN: How many turns was the original Oregon Trail?

SKIPPY: The 1971 original: 2-week turns, ~10–12 to win, hard cap ~17–18 before winter ate your family. We're running 25–35 richer encounters per voyage.

CAPTAIN: Call the game Orion Trail and make this the workspace folder.

SKIPPY: Orion Trail it is. Engine built, validated, and balanced. Twelve parallel scribes wrote the scenario library while I polished the tombstones.

**Key decisions made:**
- Engine in one self-contained `orion-trail.html`; scenario data in 12 `scenarios/*.js` files loaded via script tags (JSON impossible over `file://`, separate files enable parallel authoring)
- Route: Earth Orbit → Luna → Mars → Ceres → Europa → Titan → Kuiper → Deep Relay → Gliese 581g (25%) → Tau Ceti e (45%) → Kepler-452b (guaranteed, but two brutal deep legs away)
- System damage tiers (NOMINAL/DAMAGED/CRITICAL/OFFLINE) drive simulation penalties; power-zero causes a cascade spiral, not instant death
- Deaths are spirals with grace periods; dehydration deaths roll "dysentery. In space. Somehow." — the ancestral joke, honored
- `badOutcomeShift` per difficulty: one knob that shifts probability mass toward worst outcomes across all 158 scenarios
- Balance targets (Officer): random-play survival 10–20%, careful-play 45–60% — landed at 12% / 52%
- Validator enforces: unique ids, canonical keys, chance sums, no-free-lunch, pairwise choice dominance (variance-aware, gate-exempt)

**Notable moments:**
- First balance run: 100% of deaths by starvation — the sim wasn't spending its requisition points. Fixed; the food economy went from famine to buffet and had to be reined back twice
- The validator's first catch was Skippy's own seed content: "Quick skim of the coma" was a free lunch. Physician, heal thyself
- 12 parallel authoring agents delivered 143 scenarios with ZERO validation errors on final assembly
- Content highlights: a unionized sentient mold (Local 7, Hydroponics), a catering drone insisting someone aboard is Craig, the paid_toll pirate reputation chain, the first human burial between stars, and a fern that is legally a mining heiress
- Difficulty spread verified: Passenger 89%/38%, Officer 52%/12%, Captain 17%/7% (careful/careless survival)

**Files modified:**
- orion-trail.html (new — engine, UI, CSS, autoplay harness, ~1,400 lines)
- scenarios/*.js × 12 (new — 158 scenarios total)
- tools/validate.js (new — schema + balance gatekeeper)
- README.md (new — play guide + authoring spec)
- misc/SESSION_LOG.md (this file)

---
