# Changelog

All notable changes to the Weather Clock extension will be documented in this file.

## [1.7.0] - 2026-07-31

### Added
- Tsunami alerts now require the location to actually be reachable by one. The USGS tsunami flag means an earthquake *can* generate a tsunami, not that any given city could be hit by it, so an inland town was being warned about a wave that cannot reach it. The extension bundles the ocean coastline (`data/coastline.json`, 0.42 MB) and elevates for tsunami only within 25 km of the sea. Pehuajó (334 km inland) and Toronto (on the Great Lakes, 400 km from any ocean) no longer receive tsunami alerts, while Auckland (3.6 km) and Mar del Plata (10 km) still do.
- The tsunami flag stored on an alert now reflects whether *that location* is exposed, so the "⚠️ Tsunami Warning" line in the UI and in notifications no longer appears for inland cities.
- `tools/build_coastline.py` regenerates the coastline and refuses to write a file that fails its built-in sanity checks against ten known coastal and inland cities.

### Notes
- Coastline data comes from [Natural Earth](https://www.naturalearthdata.com/) 1:50m, public domain, no attribution required. Its coastline layer covers oceans only — lakes are a separate layer and deliberately excluded, which is why cities on the Great Lakes are correctly treated as inland.
- Simplified to every second vertex at 2 decimals, costing at most 0.5 km of accuracy against a 25 km threshold. The file is only read when a tsunami-flagged earthquake actually appears; lookups take about 4 ms per location and are then cached.
- If the coastline fails to load, locations are treated as exposed, so a data problem cannot silently suppress a genuine tsunami alert.

### Known issues
- Exposure is based on distance to the sea, not on which ocean. A tsunami-flagged Pacific earthquake will still elevate for an Atlantic coastal city. Resolving that properly needs tsunami travel-time modelling.

## [1.6.1] - 2026-07-31

### Fixed
- Earthquake alerts fired for events on the other side of the world. `mapLocalMMI` raised any magnitude 7+ earthquake to a moderate alert with no distance check at all, so a quake anywhere on Earth alerted every saved city. Measured against 30 days of USGS data for a user with Pehuajó (Argentina) and Auckland (New Zealand): exactly one alert would have fired all month — a M7.3 in Mexico, 6488 km away, with a local intensity of MMI 1.0, which the extension's own scale labels "Not felt". No alert came from shaking that could actually be felt. Alert level is now decided by the shaking that reaches the location; the tsunami flag still elevates distant events, since a tsunami does travel.
- An earthquake was only ever reported for one saved city. Both earthquake sources stopped at the first location that produced a non-info level, and because the magnitude-7 rule made every location qualify regardless of distance, that was always simply the first city in the list. A M7.5 directly beneath Auckland was reported as a Pehuajó alert — 10044 km away, marked "not felt" — while Auckland, the city being shaken, received nothing. Each location is now evaluated on the shaking it actually receives, and alerts are keyed per location like every other source.

### Changed
- The local intensity calculation, previously duplicated between the USGS and GeoNet checks, is now a shared `calculateLocalMMI` helper.

### Known issues
- The USGS tsunami flag elevates an earthquake for every saved location regardless of whether it is coastal, so a distant tsunami-flagged quake can raise an alert for an inland city. Resolving this needs coastline data the extension does not currently carry.

## [1.6.0] - 2026-07-31

Completes the work started in 1.4.0: that release fixed *when* an alert is shown, this one fixes *where*. Every source is now matched against the user's actual location.

### Fixed
- Hurricane tracking had never worked. `checkHurricanes` fetched `APIS.hurricanesAtlantic`, which does not exist — the key is `hurricanes` — so every run threw on `fetch(undefined)` and was swallowed by the catch. Verified after the fix: a point 256 km from Tropical Storm Genevieve now receives a high alert, while Miami (4800 km away) receives none.
- USA (NWS): alerts were shown to every US location regardless of distance. The code computed `distanceKm` and never used it to filter, so a Miami user saw warnings for Arizona, Montana and Rhode Island. Separately, alerts without polygon geometry were discarded entirely — 247 of 260 active alerts nationwide — so the source both showed the wrong alerts and dropped nearly all the right ones. Now queries `?point=lat,lon`, which resolves against both alert polygons and forecast zones.
- Canada (NAAD): every Canadian alert was applied to every Canadian location, even though all 230 feed entries carry a `georss:polygon` that was simply ignored. Toronto was showing 38 alerts, none of which covered Toronto — 100% false positives, and the badge displayed "38".
- Brazil (INMET): every Brazilian alert was applied to every Brazilian location. Migrated from the RSS feed to the `avisos/ativos` JSON API, which publishes the alert polygon, the severity grade and the validity window as real fields instead of an HTML table.
- Canada (NAAD): air quality alerts were mislabelled as wind, because the summary text mentions wind before the event type was checked.
- Brazil (INMET): a rate-limited response (plain text with a 200) crashed the check with a JSON parse error. It is now detected and logged.
- USA (NWS): an alert covering two saved cities was only reported for the first, because the dedup key was the alert id alone. Alerts are now keyed per location, as the other sources already were.

### Added
- `tools/check-sources.mjs` — runs the real `background.js` against the live feeds outside Chrome and asserts no alert is returned past its `expires` or attributed to a location outside its area. It found the dead hurricane source on its first run.
- `tools/build_regions.py` — regenerates `data/emma-regions.json`, so the European region data is reproducible when MeteoAlarm renumbers its regions.

### Removed
- `METEOALARM_COUNTRIES`, an unused constant that also had the wrong slug for North Macedonia (`north-macedonia` rather than `republic-of-north-macedonia`), left over from before per-country feeds were wired up.

## [1.5.0] - 2026-07-30

### Fixed
- European alerts (MeteoAlarm) had been silently dead. Two independent faults: the aggregated Europe feed was retired upstream, and the request sent `Accept: application/atom+xml, application/xml, text/xml`, which the feed server answers with 406 — it only accepts `*/*`. Europe now fetches per-country feeds with a working Accept header.
- The cube tabs (Tides / Extended / Alerts) always showed the default tab as selected. Clicking a tab rotated the cube and switched the face but never moved the `active` class, which was applied once at render time from the `defaultTab` setting. Each face carries its own copy of the tab row, so the marker is now updated across every row in the cube.

### Added
- Region-level filtering for European alerts. MeteoAlarm identifies affected areas by EMMA region code and name only — its feeds, per-alert CAP documents and JSON API all omit geometry, and the EDR API supporting spatial queries is restricted to members. Country-level filtering alone would surface 182 warnings for Spain or 540 for Germany regardless of the user's location. The extension now bundles the EMMA region polygons (`data/emma-regions.json`, 2003 regions across 35 countries, ~1.3 MB) and resolves the user's location locally, keeping only warnings covering a region that contains them. Madrid goes from 182 warnings to 2.
- Regions are matched by EMMA code *or* normalized region name, because France renumbered its codes (only 4 of 92 still match by code). Matching on either resolves 100% of the regions in every country feed tested.
- Release packaging now includes `data/` and fails the build if the region dataset is missing from the ZIP, so Europe cannot silently break in production.

### Changed
- MeteoAlarm event types are detected from a wider vocabulary, since wording varies by issuing service ("strong heat", "Heatwarning", "Moderate high-temperature warning" are all heat). Thunderstorm is checked before wind, as thunderstorm warnings usually also mention gusts.

### Known issues
- Switzerland, Ukraine, the United Kingdom and Andorra publish through MeteoAlarm but are absent from the region dataset, so no alerts are shown for them. This is logged rather than failing silently.

### Credits
- European region geometry derived from [NiklasJordan/meteoalarm](https://github.com/NiklasJordan/meteoalarm) (MIT). Region data © MeteoAlarm / EUMETNET, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## [1.4.0] - 2026-07-30

### Fixed
- Alerts were shown without ever checking whether they were in effect. The CAP `expires` field was parsed and stored but never read anywhere, and `onset` was used as the alert's timestamp, so an alert scheduled for a future day displayed as if it were happening now. Reported case: Pehuajó (Argentina) showed a yellow Thunderstorm alert while the SMN map showed the area green — the alert's onset was the *following* day at 15:00. Every alert is now filtered by its validity window; expired alerts are dropped and future ones are labelled.
- Alert retention used a fixed age cutoff (6h weather / 24h earthquakes) based on `onset`. Alerts with a future onset survived past their end, and long-running alerts issued more than 6 hours ago disappeared while still in effect. Retention now follows the alert's own `expires`, falling back to the age cutoff only for alerts without a window (earthquakes, hurricanes).
- The toolbar badge and the in-page alert banner counted alerts with a future onset as active (`Date.now() - time` was negative, passing the "recent" test). Both now exclude alerts that have not started.
- CAP cancellations (`msgType=Cancel`) and non-live messages (`status=Test/Exercise/Draft`) were treated as active alerts. Now discarded across all sources. For Canada this also covers entries titled "... ended" / "... terminée", which the feed keeps publishing after the event is over.
- Argentina SMN: only the first `<polygon>` and the first `<info>` block of each CAP document were read. Alerts carrying several info blocks (different timeframes or severities) or several areas were matched against the wrong geometry and reported with the wrong severity and validity window. Every info block and area is now checked, and severity/timing come from the block that actually covers the location.
- Argentina SMN: `Nevadas` (the SMN's actual wording) was not recognised as snow and fell back to the generic "clima" label.
- Brazil INMET: severity was read from the title, where `Perigo Potencial` (yellow, the lowest tier) matched the check for `perigo` and was reported as Severe. Tiers are now matched longest-first: Grande Perigo → Severe, Perigo → Moderate, Perigo Potencial → Minor.
- Chile MeteoChile and NZ MetService: severity was guessed from the RSS title, where `alerta` matched every Chilean item regardless of tier. Both now fetch the linked CAP document and use the severity the issuer declared, along with its polygon and validity window.
- Alerts that had not started could reach a Chrome notification worded "X min ago". Notifications now read "starts in 3h" for upcoming alerts.

### Added
- Shared CAP parsing layer (`parseCapDocument`, `fetchCapDocument`, `findCapInfoForLocation`, `getAlertWindow`, `isCapMessageLive`) used by every source, replacing per-source ad-hoc regex parsing.
- "Upcoming" badge and dimmed styling for alerts that have not taken effect yet, with a "starts 15:00" / "starts tomorrow 15:00" label instead of a misleading "X ago".
- Polygon-based location filtering for Chile and New Zealand, which previously applied every national alert to every location in the country.

### Changed
- Alerts starting more than 24 hours out are no longer surfaced at all.
- Chile and New Zealand now show fewer alerts, because their lowest tier (Chilean "Aviso", NZ "Watch" — both `severity=Minor` in CAP) is hidden like every other Minor alert, and alerts are matched to the user's polygon instead of the whole country.

### Known issues
- Europe (MeteoAlarm) is non-functional: the aggregated Europe feed (`meteoalarm-legacy-atom-europe`) was retired upstream and returns 404/406. Only per-country feeds remain, so restoring Europe requires resolving coordinates to a country. The parsing was updated to read the inline `cap:*` fields these feeds provide, but the source stays dark until the feed selection is fixed.

## [1.3.2] - 2026-04-09

### Fixed
- All weather icons broken (404 errors). Meteocons moved from GitHub Pages to npm package. Migrated icon base URL from `basmilius.github.io/weather-icons/production/line/all` to `cdn.jsdelivr.net/npm/@meteocons/svg/line` (jsDelivr CDN). No icon name changes needed.

## [1.3.1] - 2026-04-05

### Fixed
- GPS location was only fetched once on first install and never updated. Moving to a different city would keep showing the old location's weather. Now geolocation is refreshed on every page load; if coordinates shift by more than ~1km, the location name and weather update automatically. Saved coordinates are used as fallback if GPS fails.

## [1.3.0] - 2026-03-17

### Added
- Default tab setting: users can choose which tab (Tides, Extended Forecast, or Alerts) is shown by default when opening a new tab. Configurable in the settings panel.
- Default changed from Tides to Extended Forecast.

## [1.2.1] - 2026-02-16

### Fixed
- Extended forecast showed wrong day labels across timezones. `new Date("YYYY-MM-DD")` was parsed as UTC midnight, shifting dates back one day in negative-offset timezones (e.g., Americas). Now parsed as local date via manual string splitting.
- Extended forecast "Today"/"Tomorrow" labels were based on the user's local timezone instead of the viewed city's timezone. Auckland (UTC+13) showing Feb 17 would still label it "Tomorrow" from an Argentina perspective. Now uses the city's own timezone via `toLocaleString` with the `timeZone` option.

## [1.2.0] - 2026-02-09

### Fixed
- Tide data cache was single-location only, causing cache thrashing with multiple cities. Every 15-minute refresh cycle re-fetched tides for all cities (2 API calls each), exhausting the Stormglass free tier (10 requests/day) within hours. Converted to per-location cache map so each city's tide data is stored independently and persists for the full day.

### Changed
- Tide data is now lazy-loaded: only the currently visible city fetches tides on page load. When navigating to another city, tides are fetched on demand (or served from cache if already fetched that day). This reduces initial API usage from 2×N cities to just 2 requests.
- Maximum saved cities reduced from 5 to 4 (5 total with GPS) to stay within Stormglass free tier limits (10 requests/day = 5 cities × 2 endpoints).
- Old single-location tide cache format is automatically migrated to the new per-location format.

## [1.1.0] - 2026-02-04

### Added
- Alert items now include clickable "More info" links to the source (USGS, SMN, GeoNet, MetService, MeteoAlarm, INMET, MeteoChile, NAAD, NWS, NHC).
- Settings panel is now scrollable with styled scrollbar matching each theme.
- Privacy policy page (`docs/privacy.html`) for Chrome Web Store and GitHub Pages.
- GitHub Actions workflow for automatic Chrome Web Store publishing on release.
- GitHub Pages deployment workflow for the privacy policy.

### Fixed
- SMN Argentina "oladecalor" (heat wave) alerts failing with CORS errors due to `http://forms.smn.gob.ar` URLs redirecting cross-origin. Added `forms.smn.gob.ar` to host permissions and rewrite URLs to HTTPS to avoid redirects.
- Reduced excessive console logging: SMN polygon checks no longer log individually; only a summary line with matched alerts is printed.
- SMN alert severity mapping was broken: all "Moderate" (yellow) alerts were inflated to "critical" (red) by time factors. Bypassed the relevance system entirely for weather alerts — CAP severity now maps directly: Extreme→critical, Severe→high, Moderate→moderate, Minor→info.
- All alert levels were exaggerated by the relevance scoring system (time × distance factors inflated everything to critical). Replaced with direct mapping everywhere: weather alerts use CAP severity via `mapWeatherSeverity()`, earthquakes use local MMI via `mapLocalMMI()`, hurricanes use classification + distance. Tornado/tsunami/severe-thunderstorm warnings elevate one step via `elevateAlertLevel()`. Removed dead code: `ALERT_THRESHOLDS`, `DISTANCE_FACTORS`, `TIME_FACTORS`, `getDistanceFactor()`, `getTimeFactor()`, `getAlertLevel()`.
- Alert banner showed "undefinedkm from [city]" for weather alerts that have no distance (polygon-based). Now conditionally shows distance only when available.
- Alert banner kept reappearing every 30 seconds after being dismissed. Added `dismissedBannerIds` tracking so dismissed banners don't resurface.
- Alert banner showed raw "severe_weather" type as title. Now shows place/severity for weather alerts.
- City bell (alert toggle) button repositioned below the close button, hidden by default like the close button.

### Refactored
- Extracted `ALERT_TYPE_EMOJIS` and `ALERT_LEVEL_EMOJIS` constants, eliminating duplication between `loadAlerts()` and `showAlertBanner()`. Fixed missing `info` level emoji in banner.
- Converted `getStormglassErrorInfo()` switch statement to `STORMGLASS_ERRORS` object map with `uiMessage` field. Eliminated duplicated ternary chain in `displayWeather()`.
- Unified time formatting: added core `formatTime()` helper. `formatHour()`, `formatSunTime()`, and `formatPeriodTime()` are now thin wrappers.
- Extracted 4 helper functions from `displayWeather()`: `buildHourlyForecastItems()`, `buildHourlyForecastHTML()`, `buildTideSectionHTML()`, `buildExtendedForecastHTML()`.
- Extracted 2 helper functions from `loadAlerts()`: `filterAndDeduplicateAlerts()`, `renderAlertItem()`.

## [1.0.0] - 2026-02-03

### Added
- Initial release with weather display, tidal data, astronomical info, and multi-hazard disaster alerts
- Multi-city support with GPS + saved cities carousel
- 3D cube interface (Tides, Extended Forecast, Alerts)
- Stormglass API error handling with cooldown system
- Support for 15 weather models via Open-Meteo
- Solunar/fishing score calculations
- Air Quality Index display
