#!/usr/bin/env python3
"""Regenerate data/coastline.json, the bundled ocean coastline.

Used to decide whether a saved city is exposed to a tsunami. The USGS
earthquake feed flags events that can generate one, but that flag says
nothing about whether a given city could be reached: an inland town is not
at risk however large the earthquake was. So the extension measures the
distance from each location to the nearest ocean coastline (see
calculateCoastDistance in background.js).

    python3 tools/build_coastline.py

Source: Natural Earth 1:50m physical coastline, public domain.
"No permission is needed to use Natural Earth. Crediting the authors is
unnecessary." - https://www.naturalearthdata.com/about/terms-of-use/

Natural Earth's coastline layer covers oceans only; lakes are a separate
layer and are deliberately not included, so cities on the Great Lakes are
correctly treated as inland for tsunami purposes.

Output is a flat array of [lon, lat] points - the distance check only needs
proximity to the coast, not the shape of it, so the line topology is dropped.
"""

import json
import math
import os
import urllib.request

SOURCE_URL = (
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/'
    'master/geojson/ne_50m_coastline.geojson'
)
OUTPUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'coastline.json')

# Keep every Nth vertex and round to this many decimals. Measured against the
# unsimplified source over a set of coastal and inland cities: this costs at
# most 0.5 km of accuracy, which is immaterial against a ~25 km threshold.
# Dropping to every 3rd vertex costs 5.7 km, every 4th costs 46 km.
KEEP_EVERY = 2
DECIMALS = 2

# Cities used to sanity-check the result, with their expected verdict
CHECKS = [
    ('Auckland', -36.85, 174.76, True),
    ('Mar del Plata', -38.00, -57.55, True),
    ('Barcelona', 41.39, 2.17, True),
    ('Lisbon', 38.72, -9.14, True),
    ('Valparaiso', -33.05, -71.62, True),
    ('Pehuajo', -35.8137, -61.8983, False),
    ('Madrid', 40.42, -3.70, False),
    ('Cordoba', -31.42, -64.18, False),
    ('Toronto', 43.65, -79.38, False),      # Great Lakes, not ocean
    ('Santiago', -33.45, -70.67, False),    # behind the coastal range
]
COASTAL_THRESHOLD_KM = 25


def haversine(lat1, lon1, lat2, lon2):
    radius = 6371
    rad = math.pi / 180
    a = (math.sin((lat2 - lat1) * rad / 2) ** 2 +
         math.cos(lat1 * rad) * math.cos(lat2 * rad) *
         math.sin((lon2 - lon1) * rad / 2) ** 2)
    return 2 * radius * math.asin(math.sqrt(a))


def nearest_coast_km(points, lat, lon):
    best = float('inf')
    for lon2, lat2 in points:
        # Cheap bounding check first; 8 degrees comfortably exceeds any
        # threshold we care about
        if abs(lat2 - lat) > 8 or abs(lon2 - lon) > 10:
            continue
        d = haversine(lat, lon, lat2, lon2)
        if d < best:
            best = d
    return best


def main():
    print(f'Downloading {SOURCE_URL} ...')
    with urllib.request.urlopen(SOURCE_URL, timeout=300) as response:
        source = json.load(response)

    lines = []
    for feature in source['features']:
        geometry = feature['geometry']
        if geometry['type'] == 'LineString':
            lines.append(geometry['coordinates'])
        elif geometry['type'] == 'MultiLineString':
            lines.extend(geometry['coordinates'])

    points = set()
    for line in lines:
        for i in range(0, len(line), KEEP_EVERY):
            lon, lat = line[i]
            points.add((round(lon, DECIMALS), round(lat, DECIMALS)))
    points = sorted(points)

    document = {
        '_comment': 'Ocean coastline vertices as [lon, lat], for measuring how far a '
                    'location is from the sea. Lakes are excluded. Regenerate with '
                    'tools/build_coastline.py.',
        '_source': f'{SOURCE_URL} - Natural Earth 1:50m coastline',
        '_license': 'Public domain. https://www.naturalearthdata.com/about/terms-of-use/',
        '_simplification': f'every {KEEP_EVERY} vertices, rounded to {DECIMALS} decimals '
                           '(<= 0.5 km error against the source)',
        'points': [[lon, lat] for lon, lat in points],
    }

    serialized = json.dumps(document, separators=(',', ':'))
    with open(OUTPUT, 'w', encoding='utf8') as handle:
        handle.write(serialized)

    print(f'Wrote {os.path.normpath(OUTPUT)}')
    print(f'  {len(points)} points, {len(serialized) / 1024 / 1024:.2f} MB\n')

    print(f'Sanity check (coastal = within {COASTAL_THRESHOLD_KM} km of ocean):')
    failures = 0
    for name, lat, lon, expect_coastal in CHECKS:
        km = nearest_coast_km(points, lat, lon)
        is_coastal = km <= COASTAL_THRESHOLD_KM
        ok = is_coastal == expect_coastal
        failures += not ok
        shown = 'no ocean nearby' if km == float('inf') else f'{km:7.1f} km'
        print(f"  {'ok  ' if ok else 'FAIL'} {name:14} {shown}  "
              f"-> {'coastal' if is_coastal else 'inland'}")

    if failures:
        raise SystemExit(f'\n{failures} sanity check(s) failed - do not ship this file.')
    print('\nAll sanity checks passed.')


if __name__ == '__main__':
    main()
