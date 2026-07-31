#!/usr/bin/env python3
"""Regenerate data/emma-regions.json, the bundled MeteoAlarm region geometry.

MeteoAlarm identifies the area a warning covers by EMMA region code and name
only - its feeds, its per-alert CAP documents and its JSON API all omit
geometry, and the EDR API that supports spatial queries is restricted to
members. So the extension ships the region polygons and resolves the user's
location locally (see checkMeteoAlarm in background.js).

Run this when MeteoAlarm changes its regions - for example when a country
renumbers its EMMA codes, as France did.

    python3 tools/build_regions.py

Source geometry: https://github.com/NiklasJordan/meteoalarm (MIT).
Region data (c) MeteoAlarm / EUMETNET, CC BY 4.0.

Output format, kept terse because the file ships inside the extension:
    c = EMMA_ID          k = ISO country code
    n = normalized name  b = [minLon, minLat, maxLon, maxLat]
    p = outer rings, each [[lon, lat], ...]  (GeoJSON coordinate order)

Region names are normalized (accents and punctuation stripped) so that
background.js can match a warning by name when its code is unrecognised.
"""

import json
import math
import os
import re
import sys
import unicodedata
import urllib.request

SOURCE_URL = (
    'https://raw.githubusercontent.com/NiklasJordan/meteoalarm/'
    'main/src/meteoalarm/assets/geocodes.json'
)
OUTPUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'emma-regions.json')

# Douglas-Peucker tolerance in degrees, and coordinate rounding. Validated
# against the full-resolution source over 1200 points across Europe:
# 1198/1200 exact agreement, zero false positives. Raising the tolerance to
# 0.02 starts misplacing city centres (Vienna); lowering it to 0.002 doubles
# the file for one extra correct point.
TOLERANCE = 0.005
DECIMALS = 3


def normalize(name):
    """Strip accents and punctuation - must match normalizeRegionName in background.js."""
    decomposed = unicodedata.normalize('NFKD', name or '')
    without_marks = ''.join(c for c in decomposed if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]', '', without_marks.lower())


def perpendicular_distance(point, start, end):
    (x, y), (x1, y1), (x2, y2) = point, start, end
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def douglas_peucker(points, tolerance):
    if len(points) < 3:
        return points
    farthest, index = 0, 0
    for i in range(1, len(points) - 1):
        d = perpendicular_distance(points[i], points[0], points[-1])
        if d > farthest:
            farthest, index = d, i
    if farthest > tolerance:
        return douglas_peucker(points[:index + 1], tolerance)[:-1] + \
               douglas_peucker(points[index:], tolerance)
    return [points[0], points[-1]]


def simplify_ring(ring):
    simplified = douglas_peucker([tuple(p) for p in ring], TOLERANCE)
    rounded = [(round(x, DECIMALS), round(y, DECIMALS)) for x, y in simplified]

    deduped = [rounded[0]]
    for point in rounded[1:]:
        if point != deduped[-1]:
            deduped.append(point)

    if len(deduped) >= 3 and deduped[0] != deduped[-1]:
        deduped.append(deduped[0])
    return deduped if len(deduped) >= 4 else None


def outer_rings(geometry):
    """Outer rings only - holes are negligible at this simplification level."""
    kind, coords = geometry['type'], geometry['coordinates']
    if kind == 'Polygon':
        return [coords[0]]
    if kind == 'MultiPolygon':
        return [polygon[0] for polygon in coords]
    return []


def main():
    sys.setrecursionlimit(100000)

    print(f'Downloading {SOURCE_URL} ...')
    with urllib.request.urlopen(SOURCE_URL, timeout=300) as response:
        source = json.load(response)

    regions = []
    for feature in source['features']:
        properties = feature['properties']
        if not feature.get('geometry'):
            continue

        rings = [r for r in (simplify_ring(ring) for ring in outer_rings(feature['geometry'])) if r]
        if not rings:
            continue

        lons = [x for ring in rings for x, _ in ring]
        lats = [y for ring in rings for _, y in ring]

        regions.append({
            'c': properties['code'],
            'k': properties['country'],
            'n': normalize(properties['name']),
            'b': [round(min(lons), DECIMALS), round(min(lats), DECIMALS),
                  round(max(lons), DECIMALS), round(max(lats), DECIMALS)],
            'p': [[[x, y] for x, y in ring] for ring in rings],
        })

    document = {
        '_comment': 'MeteoAlarm EMMA warning regions, simplified for point-in-polygon lookup. '
                    'Coordinates are [lon, lat] (GeoJSON order). Fields: c=EMMA_ID, '
                    'k=ISO country, n=normalized name, b=[minLon,minLat,maxLon,maxLat], '
                    'p=outer rings. Regenerate with tools/build_regions.py.',
        '_source': f'{SOURCE_URL} (MIT) - derived from MeteoAlarm / EUMETNET region geometry',
        '_license': 'Region data (c) MeteoAlarm / EUMETNET, CC BY 4.0 - '
                    'https://creativecommons.org/licenses/by/4.0/',
        '_simplification': f'Douglas-Peucker tolerance {TOLERANCE} deg, '
                           f'coordinates rounded to {DECIMALS} decimals, outer rings only',
        'regions': regions,
    }

    serialized = json.dumps(document, separators=(',', ':'), ensure_ascii=False)
    with open(OUTPUT, 'w', encoding='utf8') as handle:
        handle.write(serialized)

    countries = sorted({r['k'] for r in regions})
    points = sum(len(ring) for r in regions for ring in r['p'])
    print(f'Wrote {os.path.normpath(OUTPUT)}')
    print(f'  {len(regions)} regions, {len(countries)} countries, {points} points, '
          f'{len(serialized) / 1024 / 1024:.2f} MB')
    print(f'  countries: {" ".join(countries)}')


if __name__ == '__main__':
    main()
