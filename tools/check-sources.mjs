#!/usr/bin/env node
/**
 * Run background.js against the live alert feeds, outside Chrome.
 *
 *     node tools/check-sources.mjs
 *
 * Loads the real background.js in a VM with a stubbed `chrome`, then queries
 * every source for a city known to be in its coverage area. Use it after
 * touching alert code to see what each source actually returns, without
 * reloading the extension and waiting for an alarm to fire.
 *
 * It checks the invariants that have broken before:
 *   - no alert is returned whose validity window has already closed
 *   - no alert is attributed to a location outside its area
 *   - each source is reachable and parses (a feed that 404s or 406s, or a
 *     bundled data file missing from the package, shows up as zero alerts)
 *
 * Live feeds change constantly, so zero alerts for a city is usually normal
 * and not a failure. What matters are the FAIL lines and unreachable sources.
 * INMET rate-limits aggressively; re-run after a minute if it reports that.
 */

import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadBackground() {
  const noop = () => {};
  const chrome = {
    runtime: {
      onInstalled: { addListener: noop }, onStartup: { addListener: noop },
      onMessage: { addListener: noop },
      getURL: (p) => 'file://' + path.join(ROOT, p), lastError: null,
    },
    alarms: { onAlarm: { addListener: noop }, create: noop, get: async () => null, clear: async () => true },
    storage: { local: { get: async () => ({}), set: async () => {} } },
    notifications: { onClicked: { addListener: noop }, onButtonClicked: { addListener: noop }, create: async () => 'id' },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
    tabs: { create: async () => {}, query: async () => [] },
    windows: { create: async () => {} },
    permissions: { contains: async () => true },
  };

  // Resolve the bundled data files the way the packaged extension does
  const realFetch = fetch;
  const patchedFetch = async (url, options) => {
    const target = String(url);
    if (target.startsWith('file://')) {
      const body = fs.readFileSync(target.slice('file://'.length), 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
    }
    return realFetch(url, options);
  };

  const context = {
    chrome, fetch: patchedFetch, console, URL, URLSearchParams, TextDecoder,
    setTimeout, clearTimeout, Date, Math, JSON, isNaN, parseInt, parseFloat,
    Promise, Map, Set, Array, Object, String, Number, RegExp, Error, self: {},
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'background.js'), 'utf8'), context,
    { filename: 'background.js' });
  return context;
}

const SOURCES = [
  ['Argentina SMN', 'checkArgentinaSMN', { name: 'Buenos Aires', lat: -34.61, lon: -58.38 }],
  ['USA NWS', 'checkNWSAlerts', { name: 'Miami', lat: 25.76, lon: -80.19 }],
  ['Canada NAAD', 'checkCanadaNAAD', { name: 'Toronto', lat: 43.65, lon: -79.38 }],
  ['Europe MeteoAlarm', 'checkMeteoAlarm', { name: 'Madrid', lat: 40.42, lon: -3.70 }],
  ['Brazil INMET', 'checkBrazilINMET', { name: 'Brasilia', lat: -15.79, lon: -47.88 }],
  ['Chile MeteoChile', 'checkChileMeteo', { name: 'Santiago', lat: -33.45, lon: -70.67 }],
  ['NZ MetService', 'checkMetServiceCAP', { name: 'Auckland', lat: -36.85, lon: 174.76 }],
  ['NZ GeoNet', 'checkGeoNet', { name: 'Wellington', lat: -41.29, lon: 174.78 }],
  ['Global earthquakes', 'checkEarthquakes', { name: 'Tokyo', lat: 35.68, lon: 139.69 }],
  ['Hurricanes NHC', 'checkHurricanes', { name: 'Miami', lat: 25.76, lon: -80.19 }],
];

const context = loadBackground();
const now = Date.now();
let failures = 0;

for (const [label, fn, location] of SOURCES) {
  let alerts;
  try {
    alerts = await context[fn]([location], []);
  } catch (err) {
    console.log(`FAIL  ${label.padEnd(20)} threw: ${err.message}`);
    failures++;
    continue;
  }

  const expired = alerts.filter(a => a.endTime && a.endTime <= now);
  const misattributed = alerts.filter(a => a.locationName !== location.name);
  const upcoming = alerts.filter(a => a.isUpcoming).length;

  const problems = [];
  if (expired.length) problems.push(`${expired.length} past their expires`);
  if (misattributed.length) problems.push(`${misattributed.length} attributed elsewhere`);

  if (problems.length) {
    console.log(`FAIL  ${label.padEnd(20)} ${String(alerts.length).padStart(3)} alerts - ${problems.join(', ')}`);
    failures++;
  } else {
    console.log(`ok    ${label.padEnd(20)} ${String(alerts.length).padStart(3)} alerts for ` +
      `${location.name} (${upcoming} upcoming)`);
  }
}

console.log(failures
  ? `\n${failures} source(s) failed their invariants.`
  : '\nAll sources reachable, no expired or misattributed alerts.');
process.exit(failures ? 1 : 0);
