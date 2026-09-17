#!/usr/bin/env node
/**
 * Regression test for which locations a flagged earthquake may alert.
 *
 *     node tools/check-tsunami-exposure.mjs
 *
 * The USGS tsunami flag has produced wrong alerts twice: first by elevating
 * inland cities (fixed in 1.7.0 with the coastline data), then by elevating
 * every coastal city on the planet regardless of how far away or how small
 * the earthquake was - an M5.3 off Alaska raised an alert in Christchurch,
 * 10,500 km away.
 *
 * These cases pin both halves down. They run offline against the real
 * isTsunamiExposed() and the bundled coastline, so they are cheap to run
 * after any change to the earthquake path.
 */

import { loadBackground } from './load-background.mjs';

const CHRISTCHURCH = { name: 'Christchurch', lat: -43.5321, lon: 172.6362 };
const PEHUAJO = { name: 'Pehuajo', lat: -35.81, lon: -61.90 };
const MAR_DEL_PLATA = { name: 'Mar del Plata', lat: -38.00, lon: -57.55 };

// [label, location, magnitude, distance from epicentre in km, exposed?]
const CASES = [
  ['M6.5 Alaska -> Christchurch',            CHRISTCHURCH,  6.5, 10818, false],
  ['M5.3 Alaska -> Christchurch',            CHRISTCHURCH,  5.3, 10570, false],
  ['M7.7 Alaska -> Christchurch',            CHRISTCHURCH,  7.7, 10818, false],
  ['M8.2 Chile -> Christchurch',             CHRISTCHURCH,  8.2,  9200, true],
  ['M8.2 Chile -> Mar del Plata (coastal)',  MAR_DEL_PLATA, 8.2,  1200, true],
  ['M8.2 Chile -> Pehuajo (inland)',         PEHUAJO,       8.2,  1100, false],
  ['M7.0 offshore Canterbury -> local',      CHRISTCHURCH,  7.0,    60, true],
  ['M7.7 Kermadec -> regional',              CHRISTCHURCH,  7.7,   900, true],
  ['M6.0 offshore -> below any threshold',   CHRISTCHURCH,  6.0,    40, false],
];

const context = loadBackground();
let failures = 0;

for (const [label, location, magnitude, distanceKm, expected] of CASES) {
  const exposed = await context.isTsunamiExposed(location, magnitude, distanceKm);
  if (exposed === expected) {
    console.log(`ok    ${label.padEnd(40)} exposed=${exposed}`);
  } else {
    console.log(`FAIL  ${label.padEnd(40)} exposed=${exposed}, expected ${expected}`);
    failures++;
  }
}

console.log(failures
  ? `\n${failures} tsunami exposure case(s) failed.`
  : '\nAll tsunami exposure cases behave as expected.');
process.exit(failures ? 1 : 0);
