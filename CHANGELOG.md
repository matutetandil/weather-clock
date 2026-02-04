# Changelog

All notable changes to the Weather Clock extension will be documented in this file.

## [1.1.0] - 2026-02-04

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
