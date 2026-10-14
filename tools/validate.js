#!/usr/bin/env node
/* ORION TRAIL — scenario schema + balance validator.
   Usage: node tools/validate.js
   Exit 1 on hard errors; dominance findings are warnings for human review. */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'scenarios');
const RES = ['oxygen','water','food','power','fuel','parts','meds','crew'];
const SYS = ['morale','engines','generator','lifeSupport','sensors','hull','astrogation','weapons'];
const ZONES = ['inner','belt','outer','deep','adrift'];
const WAYPOINTS = ['luna','mars','ceres','europa','titan','kuiper','relay','gliese','tauceti','kepler'];
const PREFIX = { 'mechanical.js':'mech-', 'crew-drama.js':'crew-', 'derelicts.js':'der-',
  'cosmic-hazards.js':'haz-', 'pirates.js':'pir-', 'medical.js':'med-', 'traders.js':'trd-',
  'anomalies.js':'anom-', 'waypoints.js':'wp-', 'deep-space.js':['deep-','adrift-'],
  'caches.js':'cache-', 'wildcards.js':'wild-',
  'personal.js':'pers-', 'first-contact.js':'alien-', 'ship-ai.js':'ai-', 'echoes.js':'echo-' };

const errors = [], warnings = [];
const err = (id, msg) => errors.push(`[${id}] ${msg}`);
const warn = (id, msg) => warnings.push(`[${id}] ${msg}`);

/* ---- load all files with a browser shim ---- */
global.SCENARIOS = [];
const byFile = {};
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort()) {
  const before = SCENARIOS.length;
  try { new Function('SCENARIOS', fs.readFileSync(path.join(DIR, f), 'utf8'))(SCENARIOS); }
  catch (e) { err(f, `failed to parse/execute: ${e.message}`); continue; }
  byFile[f] = SCENARIOS.slice(before);
  if (byFile[f].length === 0) warn(f, 'contains no scenarios');
}

/* ---- schema checks ---- */
const ids = new Set();
const validKeys = obj => Object.keys(obj || {}).filter(k => !RES.includes(k) && !SYS.includes(k));

for (const [file, list] of Object.entries(byFile)) {
  const prefixes = [].concat(PREFIX[file] || []);
  for (const sc of list) {
    const id = sc.id || `${file}:untitled`;
    if (!sc.id) { err(id, 'missing id'); continue; }
    if (ids.has(sc.id)) err(id, 'duplicate id');
    ids.add(sc.id);
    if (prefixes.length && !prefixes.some(p => sc.id.startsWith(p)))
      err(id, `id prefix does not match file ${file} (expected ${prefixes.join(' or ')})`);
    if (!sc.title) err(id, 'missing title');
    if (!sc.text) err(id, 'missing text');
    else if (sc.text.split(/\s+/).length > 75) warn(id, `text is ${sc.text.split(/\s+/).length} words (house rule ~60)`);
    if (sc.zones) {
      if (sc.waypoint) err(id, 'has both zones and waypoint');
      for (const z of sc.zones) if (!ZONES.includes(z)) err(id, `unknown zone "${z}"`);
    }
    if (sc.waypoint && !WAYPOINTS.includes(sc.waypoint)) err(id, `unknown waypoint "${sc.waypoint}"`);
    // requires block
    if (sc.requires) {
      for (const k of (sc.requires.systemDamaged || []).concat(sc.requires.systemOk || []))
        if (!SYS.includes(k)) err(id, `requires references unknown system "${k}"`);
      for (const k of Object.keys(sc.requires.resourceBelow || {}).concat(Object.keys(sc.requires.resourceAbove || {})))
        if (!RES.includes(k)) err(id, `requires references unknown resource "${k}"`);
    }
    // choices
    if (!Array.isArray(sc.choices) || sc.choices.length < 2 || sc.choices.length > 4)
      err(id, `has ${(sc.choices || []).length} choices (need 2–4)`);
    for (const [ci, c] of (sc.choices || []).entries()) {
      const cid = `${id}#${ci + 1}`;
      if (!c.label) err(cid, 'choice missing label');
      for (const k of validKeys(c.cost)) err(cid, `cost has unknown key "${k}"`);
      if (c.requires) {
        for (const k of (c.requires.systemOk || [])) if (!SYS.includes(k)) err(cid, `choice requires unknown system "${k}"`);
        for (const k of Object.keys(c.requires.resources || {})) if (!RES.includes(k)) err(cid, `choice requires unknown resource "${k}"`);
      }
      if (!Array.isArray(c.outcomes) || !c.outcomes.length) { err(cid, 'no outcomes'); continue; }
      const sum = c.outcomes.reduce((a, o) => a + (o.chance || 0), 0);
      if (Math.abs(sum - 1) > 0.001) err(cid, `outcome chances sum to ${sum.toFixed(3)}`);
      for (const o of c.outcomes) {
        for (const k of validKeys(o.effects)) err(cid, `effects has unknown key "${k}"`);
        for (const k of Object.keys(o.damage || {})) if (!SYS.includes(k)) err(cid, `damage has non-system key "${k}"`);
        for (const k of Object.keys(o.repair || {})) if (!SYS.includes(k)) err(cid, `repair has non-system key "${k}"`);
        if (!o.text && !o.endGame) warn(cid, 'outcome has no text');
      }
    }
  }
}

/* ---- flag wiring: every consumed flag must be set somewhere; set-but-never-consumed is a dead end ---- */
{
  const setBy = {}, usedBy = {};
  for (const sc of SCENARIOS) {
    const useFlags = r => { if (!r) return; for (const k of ['requiresFlag', 'forbidsFlag']) if (r[k]) (usedBy[r[k]] = usedBy[r[k]] || []).push(sc.id); };
    useFlags(sc.requires);
    for (const c of sc.choices || []) { useFlags(c.requires); for (const o of c.outcomes || []) if (o.flag) (setBy[o.flag] = setBy[o.flag] || []).push(sc.id); }
  }
  for (const f of Object.keys(usedBy)) if (!setBy[f]) err(usedBy[f][0], `consumes flag "${f}" that no scenario sets`);
  for (const f of Object.keys(setBy)) if (!usedBy[f]) warn(setBy[f][0], `sets flag "${f}" that no scenario consumes (dead-end flag)`);
}

/* ---- name tokens + engine-extended fields ---- */
for (const sc of SCENARIOS) {
  const blob = JSON.stringify(sc);
  const toks = [...blob.matchAll(/\{([a-z0-9]+)\}/g)].map(m => m[1]);
  for (const t of toks) if (!['crew', 'crew2', 'dead', 'ship'].includes(t)) err(sc.id, `unknown text token {${t}}`);
  const minC = sc.requires && sc.requires.resourceAbove ? sc.requires.resourceAbove.crew : undefined;
  if (toks.includes('crew2') && !(minC >= 2)) err(sc.id, 'uses {crew2} without requires.resourceAbove.crew >= 2');
  if (toks.includes('crew') && !(minC >= 1)) warn(sc.id, 'uses {crew} without requires.resourceAbove.crew >= 1');
  if (toks.includes('dead') && !(sc.requires && sc.requires.minDead >= 1)) err(sc.id, 'uses {dead} without requires.minDead >= 1');
  for (const c of sc.choices || []) for (const o of c.outcomes || [])
    if (o.surveyBonus != null && !(o.surveyBonus > 0 && o.surveyBonus <= 0.3)) err(sc.id, 'surveyBonus must be in (0, 0.3]');
}

/* ---- waypoint set-piece coverage (candidates are engine-run surveys) ---- */
const needSetpiece = ['luna','mars','ceres','europa','titan','kuiper','relay'];
const covered = new Set(SCENARIOS.filter(s => s.waypoint).map(s => s.waypoint));
for (const w of needSetpiece) if (!covered.has(w)) warn('waypoints', `no set-piece for waypoint "${w}"`);

/* ---- balance analysis ---- */
const W = { crew: 40, meds: 3, parts: 3 }; // value weights for dominance comparison
function expectedDeltas(c) {
  const d = {};
  const add = (obj, mult, sysScale) => Object.entries(obj || {}).forEach(([k, v]) =>
    d[k] = (d[k] || 0) + v * mult * (sysScale || 1));
  add(c.cost, 1);
  for (const o of c.outcomes) {
    add(o.effects, o.chance);
    add(o.damage, o.chance); add(o.repair, o.chance);
    if (o.crewDeath) d.crew = (d.crew || 0) - o.chance;
    if (o.delayDays) d._delay = (d._delay || 0) - o.delayDays * o.chance;
    if (o.endGame) d._end = (d._end || 0) - o.chance;
  }
  return d;
}
function worstCase(c) {
  let worst = 0;
  for (const o of c.outcomes) {
    let s = 0;
    const neg = obj => Object.values(obj || {}).forEach(v => { if (v < 0) s += v; });
    neg(c.cost); neg(o.effects); neg(o.damage);
    if (o.crewDeath) s -= 40;
    if (o.delayDays) s -= o.delayDays * 2;
    if (o.endGame) s -= 500;
    worst = Math.min(worst, s);
  }
  return worst;
}

for (const sc of SCENARIOS) {
  if (!sc.choices) continue;
  // no-free-lunch: a choice whose expected deltas are all >= 0 AND worst case has no downside
  // (requirement-gated choices are exempt — the gate is the price)
  for (const [ci, c] of sc.choices.entries()) {
    if (c.requires) continue;
    const exp = expectedDeltas(c);
    const allUp = Object.entries(exp).every(([k, v]) => v >= 0);
    if (allUp && worstCase(c) >= 0 && Object.keys(exp).length > 0)
      warn(`${sc.id}#${ci + 1}`, 'FREE LUNCH: no expected downside and no worst-case downside');
  }
  // dominance: A beats B everywhere it matters (skip requirement-gated A — gate is the price)
  for (let a = 0; a < sc.choices.length; a++) for (let b = 0; b < sc.choices.length; b++) {
    if (a === b) continue;
    const A = sc.choices[a], B = sc.choices[b];
    if (A.requires) continue;
    const ea = expectedDeltas(A), eb = expectedDeltas(B);
    const keys = new Set([...Object.keys(ea), ...Object.keys(eb)]);
    let geAll = true, gtSome = false;
    for (const k of keys) {
      const w = W[k] || 1;
      const va = (ea[k] || 0) * w, vb = (eb[k] || 0) * w;
      if (va < vb - 0.01) { geAll = false; break; }
      if (va > vb + 0.01) gtSome = true;
    }
    if (geAll && gtSome && worstCase(A) >= worstCase(B))
      warn(sc.id, `choice ${a + 1} ("${A.label}") dominates choice ${b + 1} ("${B.label}")`);
  }
}

/* ---- distribution report ---- */
const perCat = {}, perZone = { inner: 0, belt: 0, outer: 0, deep: 0, adrift: 0, waypoint: 0 };
let warnCount = 0;
const drain = {};
for (const sc of SCENARIOS) {
  perCat[sc.category || '?'] = (perCat[sc.category || '?'] || 0) + 1;
  if (sc.waypoint) perZone.waypoint++;
  else (sc.zones || ['inner','belt','outer','deep']).forEach(z => perZone[z]++);
  if (sc.sensorWarning) warnCount++;
  // average expected resource drain across choices (rough category economy)
  if (sc.choices) {
    const cat = sc.category || '?';
    drain[cat] = drain[cat] || {};
    for (const c of sc.choices) {
      const exp = expectedDeltas(c);
      for (const k of RES) if (exp[k]) drain[cat][k] = (drain[cat][k] || 0) + exp[k] / sc.choices.length;
    }
  }
}

console.log('═══ ORION TRAIL VALIDATOR ═══');
console.log(`scenarios: ${SCENARIOS.length} across ${Object.keys(byFile).length} files`);
console.log('\nper category:', perCat);
console.log('zone coverage (incl. omit-all):', perZone);
console.log(`sensor warnings: ${warnCount}`);
console.log('\navg expected resource delta per category (whole-category sums):');
for (const [cat, d] of Object.entries(drain)) {
  const s = Object.entries(d).map(([k, v]) => `${k}:${v > 0 ? '+' : ''}${v.toFixed(1)}`).join(' ');
  console.log(`  ${cat.padEnd(14)} ${s}`);
}
if (warnings.length) { console.log(`\n⚠ ${warnings.length} WARNINGS (review, some may be intentional):`); warnings.forEach(w => console.log('  ⚠ ' + w)); }
if (errors.length) { console.log(`\n✗ ${errors.length} ERRORS:`); errors.forEach(e => console.log('  ✗ ' + e)); process.exit(1); }
console.log('\n✓ no hard errors');
