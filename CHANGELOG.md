# Changelog

All notable changes to the Weather Clock extension will be documented in this file.

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
- Multi-city support with GPS + 5 saved cities carousel
- 3D cube interface (Tides, Extended Forecast, Alerts)
- Stormglass API error handling with cooldown system
- Support for 15 weather models via Open-Meteo
- Solunar/fishing score calculations
- Air Quality Index display
