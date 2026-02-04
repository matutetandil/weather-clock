// Meteocons base URL (animated line style)
const METEOCONS_BASE = 'https://basmilius.github.io/weather-icons/production/line/all';

// Weather code to Meteocons icon mapping (WMO codes)
const weatherCodes = {
  0: { icon: 'clear-day', iconNight: 'clear-night', description: 'Clear sky' },
  1: { icon: 'clear-day', iconNight: 'clear-night', description: 'Mainly clear' },
  2: { icon: 'partly-cloudy-day', iconNight: 'partly-cloudy-night', description: 'Partly cloudy' },
  3: { icon: 'overcast-day', iconNight: 'overcast-night', description: 'Overcast' },
  45: { icon: 'fog-day', iconNight: 'fog-night', description: 'Foggy' },
  48: { icon: 'fog-day', iconNight: 'fog-night', description: 'Depositing rime fog' },
  51: { icon: 'partly-cloudy-day-drizzle', iconNight: 'partly-cloudy-night-drizzle', description: 'Light drizzle' },
  53: { icon: 'drizzle', iconNight: 'drizzle', description: 'Moderate drizzle' },
  55: { icon: 'drizzle', iconNight: 'drizzle', description: 'Dense drizzle' },
  56: { icon: 'partly-cloudy-day-sleet', iconNight: 'partly-cloudy-night-sleet', description: 'Freezing drizzle' },
  57: { icon: 'sleet', iconNight: 'sleet', description: 'Dense freezing drizzle' },
  61: { icon: 'partly-cloudy-day-rain', iconNight: 'partly-cloudy-night-rain', description: 'Slight rain' },
  63: { icon: 'rain', iconNight: 'rain', description: 'Moderate rain' },
  65: { icon: 'rain', iconNight: 'rain', description: 'Heavy rain' },
  66: { icon: 'sleet', iconNight: 'sleet', description: 'Freezing rain' },
  67: { icon: 'sleet', iconNight: 'sleet', description: 'Heavy freezing rain' },
  71: { icon: 'partly-cloudy-day-snow', iconNight: 'partly-cloudy-night-snow', description: 'Slight snow' },
  73: { icon: 'snow', iconNight: 'snow', description: 'Moderate snow' },
  75: { icon: 'snow', iconNight: 'snow', description: 'Heavy snow' },
  77: { icon: 'snowflake', iconNight: 'snowflake', description: 'Snow grains' },
  80: { icon: 'partly-cloudy-day-rain', iconNight: 'partly-cloudy-night-rain', description: 'Slight rain showers' },
  81: { icon: 'partly-cloudy-day-rain', iconNight: 'partly-cloudy-night-rain', description: 'Moderate rain showers' },
  82: { icon: 'rain', iconNight: 'rain', description: 'Violent rain showers' },
  85: { icon: 'partly-cloudy-day-snow', iconNight: 'partly-cloudy-night-snow', description: 'Slight snow showers' },
  86: { icon: 'snow', iconNight: 'snow', description: 'Heavy snow showers' },
  95: { icon: 'thunderstorms-day', iconNight: 'thunderstorms-night', description: 'Thunderstorm' },
  96: { icon: 'thunderstorms-day-rain', iconNight: 'thunderstorms-night-rain', description: 'Thunderstorm with hail' },
  99: { icon: 'thunderstorms-day-rain', iconNight: 'thunderstorms-night-rain', description: 'Thunderstorm with heavy hail' }
};

// Moon phase icons (Meteocons)
const moonPhaseIcons = {
  'new': 'moon-new',
  'waxing-crescent': 'moon-waxing-crescent',
  'first-quarter': 'moon-first-quarter',
  'waxing-gibbous': 'moon-waxing-gibbous',
  'full': 'moon-full',
  'waning-gibbous': 'moon-waning-gibbous',
  'last-quarter': 'moon-last-quarter',
  'waning-crescent': 'moon-waning-crescent'
};

// Available themes
const themes = ['dark', 'midnight', 'charcoal', 'violet', 'ocean', 'forest', 'crimson', 'light', 'cream'];

// Weather model configurations - all use /v1/forecast with &models= param
const weatherModels = {
  'auto': { models: '', name: 'Auto (Best Match)' },
  'ecmwf_ifs': { models: 'ecmwf_ifs', name: 'ECMWF IFS 9km' },
  'ecmwf_ifs025': { models: 'ecmwf_ifs025', name: 'ECMWF IFS 0.25°' },
  'ecmwf_aifs025': { models: 'ecmwf_aifs025', name: 'ECMWF AIFS (AI)' },
  'gfs_seamless': { models: 'gfs_seamless', name: 'GFS (NOAA USA)' },
  'icon_seamless': { models: 'icon_seamless', name: 'DWD ICON (Germany)' },
  'gem_seamless': { models: 'gem_seamless', name: 'GEM (Canada)' },
  'jma_seamless': { models: 'jma_seamless', name: 'JMA (Japan)' },
  'metno_seamless': { models: 'metno_seamless', name: 'MET Norway (Nordic)' },
  'meteofrance_seamless': { models: 'meteofrance_seamless', name: 'Météo-France' },
  'ukmo_seamless': { models: 'ukmo_seamless', name: 'UK Met Office' },
  'bom_access_global': { models: 'bom_access_global', name: 'BOM (Australia)' },
  'cma_grapes_global': { models: 'cma_grapes_global', name: 'CMA (China)' },
  'knmi_seamless': { models: 'knmi_seamless', name: 'KNMI (Netherlands)' },
  'dmi_seamless': { models: 'dmi_seamless', name: 'DMI (Denmark)' }
};

// Default settings
let settings = {
  unit: 'celsius',
  timeFormat: '24',
  showSeconds: true,
  theme: 'dark',
  lat: null,
  lon: null,
  locationName: null,
  stormglassApiKey: '',
  showAqiDetails: false,
  weatherModel: 'auto',
  savedCities: [] // Array of { name, lat, lon }
};

// Max saved cities (excluding GPS)
const MAX_CITIES = 5;

// Carousel state
let currentSlide = 0;
let slideData = []; // Cached weather data per slide

// Tide cache
let tideCache = {
  data: null,
  date: null,
  lat: null,
  lon: null,
  error: null,       // { code, message, until }
};

// Load settings from storage
async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get(['weatherClockSettings', 'tideCache']);
    if (stored.weatherClockSettings) {
      settings = { ...settings, ...stored.weatherClockSettings };
    }
    if (stored.tideCache) {
      tideCache = stored.tideCache;
    }
    // Migrate old model keys to new format
    const modelMigration = { 'ecmwf': 'ecmwf_ifs', 'gfs': 'gfs_seamless', 'icon': 'icon_seamless', 'gem': 'gem_seamless', 'jma': 'jma_seamless', 'metno': 'metno_seamless' };
    if (settings.weatherModel && modelMigration[settings.weatherModel]) {
      settings.weatherModel = modelMigration[settings.weatherModel];
      saveSettings();
    }
  } catch (e) {
    console.log('Could not load settings:', e);
  }
  applySettings();
}

// Save settings to storage
async function saveSettings() {
  try {
    await chrome.storage.local.set({ weatherClockSettings: settings });
  } catch (e) {
    console.log('Could not save settings:', e);
  }
}

// Apply settings to UI
function applySettings() {
  document.getElementById('unitSelect').value = settings.unit;
  document.getElementById('timeFormat').value = settings.timeFormat;
  document.getElementById('showSeconds').value = settings.showSeconds.toString();
  document.getElementById('stormglassApiKey').value = settings.stormglassApiKey || '';
  document.getElementById('showAqiDetails').value = settings.showAqiDetails.toString();
  document.getElementById('weatherModel').value = settings.weatherModel || 'auto';
  document.getElementById('alertsEnabled').value = (settings.alertsEnabled !== false).toString();
  document.getElementById('alertLevel').value = settings.alertLevel || 'medium';
  applyTheme(settings.theme);
}

// Apply theme to body
function applyTheme(themeName) {
  themes.forEach(t => document.body.classList.remove(`theme-${t}`));
  document.body.classList.add(`theme-${themeName}`);
  document.querySelectorAll('.theme-option').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === themeName);
  });
}

// Update clock
function updateClock() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');

  let suffix = '';
  if (settings.timeFormat === '12') {
    suffix = hours >= 12 ? ' PM' : ' AM';
    hours = hours % 12 || 12;
  }

  document.getElementById('hours').textContent = hours.toString().padStart(2, '0');
  document.getElementById('minutes').textContent = minutes;
  
  const secondsEl = document.getElementById('seconds');
  if (settings.showSeconds) {
    secondsEl.textContent = seconds;
    secondsEl.style.display = 'inline';
  } else {
    secondsEl.style.display = 'none';
  }

  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('date').textContent = now.toLocaleDateString('en-US', options);
}

// Get user's location
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}

// Get location name from coordinates
async function getLocationName(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
      { headers: { 'User-Agent': 'WeatherClockExtension/1.0' } }
    );
    const data = await response.json();
    
    const city = data.address.city || data.address.town || data.address.village || data.address.municipality;
    const country = data.address.country;
    
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    if (data.display_name) {
      return data.display_name.split(',').slice(0, 2).join(',').trim();
    }
    return 'Unknown location';
  } catch (e) {
    console.log('Could not get location name:', e);
    return null;
  }
}

// Search cities using Open-Meteo Geocoding API
async function searchCities(query) {
  if (!query || query.length < 2) return [];
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`
    );
    const data = await response.json();
    if (!data.results) return [];
    return data.results.map(r => ({
      name: r.name,
      admin1: r.admin1 || '',
      country: r.country || '',
      lat: r.latitude,
      lon: r.longitude,
      displayName: [r.name, r.admin1, r.country].filter(Boolean).join(', ')
    }));
  } catch (e) {
    console.log('City search error:', e);
    return [];
  }
}

// Fetch weather from Open-Meteo (with 2 days for midnight crossing)
async function fetchWeather(lat, lon) {
  const baseUrl = 'https://api.open-meteo.com/v1/forecast';
  const modelConfig = weatherModels[settings.weatherModel] || weatherModels['auto'];
  const modelsParam = modelConfig.models ? `&models=${modelConfig.models}` : '';
  
  const currentParams = 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,uv_index,cloud_cover,visibility';
  const hourlyParams = 'temperature_2m,weather_code,precipitation_probability';
  const dailyParams = 'temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,weather_code';
  
  const url = `${baseUrl}?latitude=${lat}&longitude=${lon}&current=${currentParams}&hourly=${hourlyParams}&daily=${dailyParams}&timezone=auto&forecast_days=16${modelsParam}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      // If model fails and it's not auto, fallback to auto
      if (settings.weatherModel !== 'auto') {
        console.log(`Model ${settings.weatherModel} failed, falling back to auto`);
        const fallbackUrl = `${baseUrl}?latitude=${lat}&longitude=${lon}&current=${currentParams}&hourly=${hourlyParams}&daily=${dailyParams}&timezone=auto&forecast_days=16`;
        const fallbackResponse = await fetch(fallbackUrl);
        if (!fallbackResponse.ok) throw new Error('Weather API error');
        return await fallbackResponse.json();
      }
      throw new Error('Weather API error');
    }
    return await response.json();
  } catch (e) {
    // Fallback to auto on any error
    if (settings.weatherModel !== 'auto') {
      console.log(`Model ${settings.weatherModel} error, falling back to auto:`, e);
      const fallbackUrl = `${baseUrl}?latitude=${lat}&longitude=${lon}&current=${currentParams}&hourly=${hourlyParams}&daily=${dailyParams}&timezone=auto&forecast_days=16`;
      const fallbackResponse = await fetch(fallbackUrl);
      if (!fallbackResponse.ok) throw new Error('Weather API error');
      return await fallbackResponse.json();
    }
    throw e;
  }
}

// Fetch Air Quality from Open-Meteo
async function fetchAirQuality(lat, lon) {
  try {
    const params = ['european_aqi', 'pm10', 'pm2_5', 'ozone', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide'];
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=${params.join(',')}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.log('Air Quality API error:', response.status);
      return null;
    }
    return await response.json();
  } catch (e) {
    console.log('Could not fetch air quality:', e);
    return null;
  }
}

// Get AQI rating and color
function getAQIRating(aqi) {
  if (aqi <= 20) return { label: 'Good', color: '#4ade80', emoji: '🟢' };
  if (aqi <= 40) return { label: 'Fair', color: '#a3e635', emoji: '🟢' };
  if (aqi <= 60) return { label: 'Moderate', color: '#fbbf24', emoji: '🟡' };
  if (aqi <= 80) return { label: 'Poor', color: '#fb923c', emoji: '🟠' };
  if (aqi <= 100) return { label: 'Very Poor', color: '#f87171', emoji: '🔴' };
  return { label: 'Hazardous', color: '#c084fc', emoji: '🟣' };
}

// Convert wind direction degrees to cardinal
function getWindDirection(degrees) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

// Wind direction arrow - meteorological convention: wind FROM a direction
// So wind_direction=0 (from North) means arrow points South (↓)
// We rotate the arrow by the degrees value (arrow points in the direction the wind is going)
function getWindArrow(degrees) {
  return `<span class="wind-arrow" style="display:inline-block;transform:rotate(${degrees}deg)">↓</span>`;
}

// Get local time for a city using its timezone
function getCityLocalTime(timezone) {
  try {
    const now = new Date();
    const options = {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: settings.timeFormat === '12'
    };
    const timeStr = now.toLocaleTimeString('en-US', options);
    
    // Get the date in both timezones to compare
    const localDate = now.toLocaleDateString('en-US', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    const cityDate = now.toLocaleDateString('en-US', { timeZone: timezone });
    
    let dayDiff = '';
    if (localDate !== cityDate) {
      const localParts = localDate.split('/');
      const cityParts = cityDate.split('/');
      const localDay = parseInt(localParts[1]);
      const cityDay = parseInt(cityParts[1]);
      
      if (cityDay > localDay || (cityDay === 1 && localDay > 1)) {
        dayDiff = ' +1 day';
      } else if (cityDay < localDay || (localDay === 1 && cityDay > 1)) {
        dayDiff = ' -1 day';
      }
    }
    
    return { time: timeStr, dayDiff };
  } catch (e) {
    console.log('Error getting city time:', e);
    return null;
  }
}

// Check if city timezone is different from local
function isDifferentTimezone(cityTimezone) {
  try {
    const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (localTimezone === cityTimezone) return false;
    
    // Also check if they have the same offset right now (some cities share offset but different TZ names)
    const now = new Date();
    const localTime = now.toLocaleTimeString('en-US', { timeZone: localTimezone, hour: '2-digit', minute: '2-digit' });
    const cityTime = now.toLocaleTimeString('en-US', { timeZone: cityTimezone, hour: '2-digit', minute: '2-digit' });
    
    return localTime !== cityTime;
  } catch (e) {
    return false;
  }
}

// Get UV index icon (uv-index-1 to uv-index-11)
function getUVIndexIcon(uvIndex) {
  const level = Math.min(11, Math.max(1, Math.round(uvIndex)));
  return `${METEOCONS_BASE}/uv-index-${level}.svg`;
}

// Get UV index level description
function getUVLevel(uvIndex) {
  if (uvIndex <= 2) return { label: 'Low', color: '#4ade80' };
  if (uvIndex <= 5) return { label: 'Moderate', color: '#fbbf24' };
  if (uvIndex <= 7) return { label: 'High', color: '#fb923c' };
  if (uvIndex <= 10) return { label: 'Very High', color: '#f87171' };
  return { label: 'Extreme', color: '#c084fc' };
}

// Get Wind Beaufort scale icon (wind-beaufort-0 to wind-beaufort-12)
function getWindBeaufortIcon(windSpeedKmh) {
  // Convert km/h to Beaufort scale
  let beaufort = 0;
  if (windSpeedKmh < 1) beaufort = 0;
  else if (windSpeedKmh < 6) beaufort = 1;
  else if (windSpeedKmh < 12) beaufort = 2;
  else if (windSpeedKmh < 20) beaufort = 3;
  else if (windSpeedKmh < 29) beaufort = 4;
  else if (windSpeedKmh < 39) beaufort = 5;
  else if (windSpeedKmh < 50) beaufort = 6;
  else if (windSpeedKmh < 62) beaufort = 7;
  else if (windSpeedKmh < 75) beaufort = 8;
  else if (windSpeedKmh < 89) beaufort = 9;
  else if (windSpeedKmh < 103) beaufort = 10;
  else if (windSpeedKmh < 118) beaufort = 11;
  else beaufort = 12;
  
  return `${METEOCONS_BASE}/wind-beaufort-${beaufort}.svg`;
}

// Convert temperature
function convertTemp(tempCelsius) {
  if (settings.unit === 'fahrenheit') {
    return Math.round((tempCelsius * 9/5) + 32);
  }
  return Math.round(tempCelsius);
}

// Get temp unit symbol
function getTempUnit() {
  return settings.unit === 'fahrenheit' ? '°F' : '°C';
}

// Core time formatting helper
function formatTime(date, { showMinutes = true, showAmPm = true } = {}) {
  let hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  if (settings.timeFormat === '12') {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const suffix = showAmPm ? ampm : '';
    return showMinutes ? `${hours}:${minutes}${suffix}` : `${hours}${suffix}`;
  }
  return showMinutes ? `${hours}:${minutes}` : `${hours}:00`;
}

// Format hour for display (e.g. "3PM" or "15:00")
function formatHour(date) {
  return formatTime(date, { showMinutes: false, showAmPm: true });
}

// Format time for sunrise/sunset (e.g. "6:30" or "6:30")
function formatSunTime(isoString) {
  return formatTime(new Date(isoString), { showMinutes: true, showAmPm: false });
}

// Check if time is night
function isNightTime(date, sunrise, sunset) {
  const time = date.getTime();
  return time < sunrise.getTime() || time > sunset.getTime();
}

// Get Meteocons icon URL
function getWeatherIconUrl(weatherCode, isNight = false) {
  const info = weatherCodes[weatherCode] || { icon: 'not-available', iconNight: 'not-available' };
  const iconName = isNight ? info.iconNight : info.icon;
  return `${METEOCONS_BASE}/${iconName}.svg`;
}

// ============================================
// MOON PHASE CALCULATIONS
// ============================================

function getMoonPhase(date = new Date()) {
  // Calculate moon phase using a simplified algorithm
  // Based on the synodic month (29.53059 days)
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Calculate Julian Day Number
  let a = Math.floor((14 - month) / 12);
  let y = year + 4800 - a;
  let m = month + 12 * a - 3;
  let jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  
  // Known new moon: January 6, 2000 (JD 2451550.1)
  const knownNewMoon = 2451550.1;
  const synodicMonth = 29.53059;
  
  // Calculate days since known new moon
  const daysSinceNew = jd - knownNewMoon;
  const lunations = daysSinceNew / synodicMonth;
  const phase = lunations - Math.floor(lunations); // 0 to 1
  
  // Calculate illumination percentage (approximate)
  const illumination = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);
  
  // Determine phase name
  let phaseName, phaseKey;
  if (phase < 0.0625 || phase >= 0.9375) {
    phaseName = 'New Moon';
    phaseKey = 'new';
  } else if (phase < 0.1875) {
    phaseName = 'Waxing Crescent';
    phaseKey = 'waxing-crescent';
  } else if (phase < 0.3125) {
    phaseName = 'First Quarter';
    phaseKey = 'first-quarter';
  } else if (phase < 0.4375) {
    phaseName = 'Waxing Gibbous';
    phaseKey = 'waxing-gibbous';
  } else if (phase < 0.5625) {
    phaseName = 'Full Moon';
    phaseKey = 'full';
  } else if (phase < 0.6875) {
    phaseName = 'Waning Gibbous';
    phaseKey = 'waning-gibbous';
  } else if (phase < 0.8125) {
    phaseName = 'Last Quarter';
    phaseKey = 'last-quarter';
  } else {
    phaseName = 'Waning Crescent';
    phaseKey = 'waning-crescent';
  }
  
  return {
    phase,          // 0 to 1
    illumination,   // 0 to 100
    phaseName,
    phaseKey,
    iconUrl: `${METEOCONS_BASE}/${moonPhaseIcons[phaseKey]}.svg`
  };
}

// ============================================
// SOLUNAR / FISHING CALCULATIONS
// ============================================

function calculateMoonTimes(date, lat) {
  // Simplified moon rise/set calculation
  // This is an approximation - for precise times you'd need a full ephemeris
  const moonPhase = getMoonPhase(date);
  const phase = moonPhase.phase;
  
  // Moon rises roughly 50 minutes later each day
  // At new moon, moon rises/sets with sun
  // At full moon, moon rises at sunset
  const baseRiseHour = 6 + (phase * 12); // Rough approximation
  const baseSetHour = 18 + (phase * 12);
  
  const moonrise = new Date(date);
  moonrise.setHours(Math.floor(baseRiseHour % 24), Math.floor((baseRiseHour % 1) * 60), 0, 0);
  
  const moonset = new Date(date);
  moonset.setHours(Math.floor(baseSetHour % 24), Math.floor((baseSetHour % 1) * 60), 0, 0);
  
  // Moon overhead (transit) - roughly 6 hours after rise
  const moonOverhead = new Date(moonrise.getTime() + 6 * 60 * 60 * 1000);
  
  // Moon underfoot - 12 hours from overhead
  const moonUnderfoot = new Date(moonOverhead.getTime() + 12 * 60 * 60 * 1000);
  
  return { moonrise, moonset, moonOverhead, moonUnderfoot };
}

function calculateFishingScore(date, moonPhase, sunrise, sunset, pressure, tideData = null) {
  let score = 0;
  const hour = date.getHours();
  const now = date.getTime();
  
  // ================================================
  // 1. MOON PHASE SCORING (Based on Solunar Theory)
  // New Moon and Full Moon = strongest gravitational pull = best fishing
  // ================================================
  if (moonPhase.phaseKey === 'new' || moonPhase.phaseKey === 'full') {
    score += 25; // Best days
  } else if (moonPhase.phaseKey === 'first-quarter' || moonPhase.phaseKey === 'last-quarter') {
    score += 15; // Good days
  } else if (moonPhase.phaseKey === 'waxing-gibbous' || moonPhase.phaseKey === 'waning-gibbous') {
    score += 10;
  } else {
    score += 5; // Crescent phases - average
  }
  
  // ================================================
  // 2. SOLUNAR PERIODS (Major & Minor feeding times)
  // Major: Moon overhead/underfoot - fish most active
  // Minor: Moonrise/moonset - fish active
  // ================================================
  const moonTimes = calculateMoonTimes(date, settings.lat || 0);
  
  // Check if currently in a Major period (±1 hour from overhead/underfoot)
  const overheadDiff = Math.abs(now - moonTimes.moonOverhead.getTime()) / (60 * 60 * 1000);
  const underfootDiff = Math.abs(now - moonTimes.moonUnderfoot.getTime()) / (60 * 60 * 1000);
  const inMajorPeriod = overheadDiff <= 1 || underfootDiff <= 1;
  
  // Check if currently in a Minor period (±30 min from moonrise/moonset)
  const moonriseDiff = Math.abs(now - moonTimes.moonrise.getTime()) / (60 * 60 * 1000);
  const moonsetDiff = Math.abs(now - moonTimes.moonset.getTime()) / (60 * 60 * 1000);
  const inMinorPeriod = moonriseDiff <= 0.5 || moonsetDiff <= 0.5;
  
  if (inMajorPeriod) {
    score += 25; // Major feeding time
  } else if (inMinorPeriod) {
    score += 15; // Minor feeding time
  }
  
  // ================================================
  // 3. SUNRISE/SUNSET BONUS
  // Dawn and dusk trigger feeding in predatory fish
  // Extra bonus if coincides with solunar period ("Best++")
  // ================================================
  const sunriseTime = sunrise.getTime();
  const sunsetTime = sunset.getTime();
  const nearSunrise = Math.abs(now - sunriseTime) / (60 * 60 * 1000) <= 1;
  const nearSunset = Math.abs(now - sunsetTime) / (60 * 60 * 1000) <= 1;
  
  if (nearSunrise || nearSunset) {
    score += 15;
    // Bonus if solunar period coincides with sunrise/sunset
    if (inMajorPeriod || inMinorPeriod) {
      score += 10; // "Best++" condition
    }
  }
  
  // ================================================
  // 4. BAROMETRIC PRESSURE (Key factor)
  // Falling pressure = BEST (fish feed before storm)
  // Stable 1005-1025 mbar = Good
  // Very high (>1030) or very low (<1000) = Poor
  // ================================================
  if (pressure) {
    // We can't detect "falling" without historical data, so we score based on value
    if (pressure >= 1005 && pressure <= 1025) {
      score += 15; // Ideal range
    } else if (pressure >= 1000 && pressure <= 1030) {
      score += 10; // Acceptable range
    } else if (pressure < 1000) {
      score += 5; // Low pressure - storm, fish deep
    } else {
      score += 5; // High pressure - fish sluggish
    }
  }
  
  // ================================================
  // 5. TIDE SCORING (for coastal fishing)
  // Moving tide (rising or falling) = Good
  // Slack tide = Poor (fish don't feed)
  // ================================================
  if (tideData && tideData.seaLevel && tideData.seaLevel.length >= 2) {
    const tideState = getTideState(tideData, date);
    
    if (tideState === 'rising' || tideState === 'falling') {
      score += 10; // Moving water = active fish
    } else if (tideState === 'slack') {
      score -= 5; // Slack tide = slow fishing
    }
  }
  
  return Math.min(100, Math.max(0, score));
}

// Helper function to determine tide state
function getTideState(tideData, date) {
  if (!tideData || !tideData.seaLevel || tideData.seaLevel.length < 2) {
    return 'unknown';
  }
  
  const now = date.getTime();
  
  // Find the two closest sea level readings
  let before = null;
  let after = null;
  
  for (let i = 0; i < tideData.seaLevel.length; i++) {
    const reading = tideData.seaLevel[i];
    const readingTime = new Date(reading.time).getTime();
    
    if (readingTime <= now) {
      before = reading;
    } else if (!after) {
      after = reading;
      break;
    }
  }
  
  if (!before || !after) {
    return 'unknown';
  }
  
  const beforeHeight = before.sg || before.height || 0;
  const afterHeight = after.sg || after.height || 0;
  const diff = afterHeight - beforeHeight;
  
  // If difference is very small, it's slack tide
  if (Math.abs(diff) < 0.05) {
    return 'slack';
  }
  
  return diff > 0 ? 'rising' : 'falling';
}

function getFishingRating(score) {
  if (score >= 70) {
    return { rating: 'EXCELLENT', fish: '🐟🐟🐟🐟', color: '#4ade80' };
  } else if (score >= 50) {
    return { rating: 'GOOD', fish: '🐟🐟🐟', color: '#a3e635' };
  } else if (score >= 30) {
    return { rating: 'FAIR', fish: '🐟🐟', color: '#fbbf24' };
  } else {
    return { rating: 'POOR', fish: '🐟', color: '#f87171' };
  }
}

function getSolunarPeriods(date, sunrise, sunset) {
  const moonTimes = calculateMoonTimes(date, settings.lat || 0);
  
  // Major periods: Moon overhead and underfoot (2 hours each)
  // Minor periods: Moonrise and moonset (1 hour each)
  const periods = [];
  
  // Add major periods
  const overheadStart = new Date(moonTimes.moonOverhead.getTime() - 60 * 60 * 1000);
  const overheadEnd = new Date(moonTimes.moonOverhead.getTime() + 60 * 60 * 1000);
  periods.push({ type: 'major', start: overheadStart, end: overheadEnd, label: 'Major' });
  
  const underfootStart = new Date(moonTimes.moonUnderfoot.getTime() - 60 * 60 * 1000);
  const underfootEnd = new Date(moonTimes.moonUnderfoot.getTime() + 60 * 60 * 1000);
  periods.push({ type: 'major', start: underfootStart, end: underfootEnd, label: 'Major' });
  
  // Add minor periods
  const moonriseStart = new Date(moonTimes.moonrise.getTime() - 30 * 60 * 1000);
  const moonriseEnd = new Date(moonTimes.moonrise.getTime() + 30 * 60 * 1000);
  periods.push({ type: 'minor', start: moonriseStart, end: moonriseEnd, label: 'Minor' });
  
  const moonsetStart = new Date(moonTimes.moonset.getTime() - 30 * 60 * 1000);
  const moonsetEnd = new Date(moonTimes.moonset.getTime() + 30 * 60 * 1000);
  periods.push({ type: 'minor', start: moonsetStart, end: moonsetEnd, label: 'Minor' });
  
  return periods.sort((a, b) => a.start - b.start);
}

// Format time for solunar periods (e.g. "6:30PM" or "6:30")
function formatPeriodTime(date) {
  return formatTime(date);
}

// ============================================
// TIDE DATA (Stormglass API with caching)
// ============================================

async function saveTideCache() {
  try {
    await chrome.storage.local.set({ tideCache });
  } catch (e) {
    console.log('Could not save tide cache:', e);
  }
}

function isTideCacheValid(lat, lon) {
  if (!tideCache.data || !tideCache.date) return false;
  
  // Check if same day
  const today = new Date().toDateString();
  if (tideCache.date !== today) return false;
  
  // Check if same location (within ~1km)
  if (Math.abs(tideCache.lat - lat) > 0.01) return false;
  if (Math.abs(tideCache.lon - lon) > 0.01) return false;
  
  return true;
}

async function fetchTideData(lat, lon) {
  // Check cache first
  if (isTideCacheValid(lat, lon)) {
    console.log('Using cached tide data');
    return tideCache.data;
  }

  // No API key? Return null
  if (!settings.stormglassApiKey) {
    console.log('No Stormglass API key configured');
    return null;
  }

  // Check if we have a cached error with a cooldown period still active
  if (tideCache.error && tideCache.error.until && Date.now() < tideCache.error.until) {
    const remaining = Math.ceil((tideCache.error.until - Date.now()) / 60000);
    console.log(`Weather Clock: Stormglass cooldown active (${remaining} min remaining) - ${tideCache.error.message}`);
    return null;
  }

  console.log('Fetching fresh tide data from Stormglass');

  try {
    // Get sea level data for today (hourly)
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setHours(23, 59, 59, 999);

    const seaLevelUrl = `https://api.stormglass.io/v2/tide/sea-level/point?lat=${lat}&lng=${lon}&start=${start.toISOString()}&end=${end.toISOString()}`;
    const extremesUrl = `https://api.stormglass.io/v2/tide/extremes/point?lat=${lat}&lng=${lon}&start=${start.toISOString()}&end=${end.toISOString()}`;

    const headers = { 'Authorization': settings.stormglassApiKey };

    const [seaLevelRes, extremesRes] = await Promise.all([
      fetch(seaLevelUrl, { headers }),
      fetch(extremesUrl, { headers })
    ]);

    // Handle API errors with specific messages
    const failedRes = !seaLevelRes.ok ? seaLevelRes : (!extremesRes.ok ? extremesRes : null);
    if (failedRes) {
      const status = failedRes.status;
      const errorInfo = getStormglassErrorInfo(status);

      console.error(`Weather Clock: Stormglass API error ${status} - ${errorInfo.message}`);

      tideCache.error = {
        code: status,
        message: errorInfo.message,
        until: Date.now() + errorInfo.cooldownMs
      };
      tideCache.data = null;
      saveTideCache();

      return null;
    }

    const seaLevelData = await seaLevelRes.json();
    const extremesData = await extremesRes.json();

    const tideData = {
      seaLevel: seaLevelData.data || [],
      extremes: extremesData.data || [],
      station: seaLevelData.meta?.station?.name || 'Unknown station'
    };

    // Save to cache and clear any previous error
    tideCache = {
      data: tideData,
      date: now.toDateString(),
      lat,
      lon,
      error: null
    };
    saveTideCache();

    return tideData;

  } catch (e) {
    console.error('Weather Clock: Error fetching tide data:', e);
    tideCache.error = {
      code: 0,
      message: 'Network error - check your connection',
      until: Date.now() + 2 * 60 * 1000 // 2 min cooldown for network errors
    };
    tideCache.data = null;
    saveTideCache();
    return null;
  }
}

const STORMGLASS_ERRORS = {
  402: { message: 'Daily request limit exceeded', cooldownMs: 60 * 60 * 1000, uiMessage: 'Daily limit reached - retrying later' },
  403: { message: 'API key missing or malformed', cooldownMs: 30 * 60 * 1000, uiMessage: 'API key missing or malformed - check settings' },
  404: { message: 'API endpoint not found', cooldownMs: 24 * 60 * 60 * 1000, uiMessage: 'Tide service error' },
  405: { message: 'API method not allowed', cooldownMs: 24 * 60 * 60 * 1000, uiMessage: 'Tide service error' },
  410: { message: 'API endpoint deprecated', cooldownMs: 24 * 60 * 60 * 1000, uiMessage: 'Tide service error' },
  422: { message: 'Invalid request parameters', cooldownMs: 24 * 60 * 60 * 1000, uiMessage: 'Tide service error' },
  503: { message: 'Stormglass service unavailable', cooldownMs: 10 * 60 * 1000, uiMessage: 'Stormglass unavailable - retrying later' }
};

function getStormglassErrorInfo(status) {
  return STORMGLASS_ERRORS[status] || {
    message: `Unexpected error (${status})`,
    cooldownMs: 5 * 60 * 1000,
    uiMessage: 'Tide data unavailable'
  };
}

function getTideDataForHours(tideData, hours) {
  if (!tideData || !tideData.seaLevel || tideData.seaLevel.length === 0) {
    return null;
  }
  
  const now = new Date();
  const result = [];
  
  for (let i = 0; i < hours.length; i++) {
    const targetTime = hours[i].getTime();
    
    // Find closest sea level reading
    let closest = tideData.seaLevel[0];
    let minDiff = Math.abs(new Date(closest.time).getTime() - targetTime);
    
    for (const reading of tideData.seaLevel) {
      const diff = Math.abs(new Date(reading.time).getTime() - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = reading;
      }
    }
    
    result.push({
      time: hours[i],
      height: closest.sg || closest.height || 0
    });
  }
  
  return result;
}

function getNextTideExtreme(tideData) {
  if (!tideData || !tideData.extremes || tideData.extremes.length === 0) {
    return null;
  }
  
  const now = new Date();
  
  for (const extreme of tideData.extremes) {
    const extremeTime = new Date(extreme.time);
    if (extremeTime > now) {
      return {
        type: extreme.type, // 'high' or 'low'
        time: extremeTime,
        height: extreme.height
      };
    }
  }
  
  return null;
}

function generateTideHTML(tideHeights) {
  if (!tideHeights || tideHeights.length < 2) {
    return '';
  }
  
  // Find min/max for scaling
  const heights = tideHeights.map(t => t.height);
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);
  const range = maxH - minH || 1;
  
  // Generate bars for each hour
  const barsHTML = tideHeights.map((t, i) => {
    const heightPercent = ((t.height - minH) / range) * 100;
    const minBarHeight = 10; // minimum 10% so it's always visible
    const barHeight = Math.max(minBarHeight, heightPercent);
    const hour = t.time.getHours();
    const isNow = i === 0;
    const heightLabel = t.height.toFixed(1) + 'm';
    
    return `
      <div class="tide-hour ${isNow ? 'tide-hour-now' : ''}">
        <div class="tide-hour-bar">
          <div class="tide-hour-fill" style="height: ${barHeight}%"></div>
        </div>
        <div class="tide-hour-time">${hour}:00</div>
        <div class="tide-hour-height">${heightLabel}</div>
      </div>
    `;
  }).join('');
  
  return barsHTML;
}

// ============================================
// DISPLAY FUNCTIONS
// ============================================

// Build 12-hour forecast array with sun events interleaved
function buildHourlyForecastItems(hourly, cityNow, daily, todaySunrise, todaySunset, tomorrowSunrise, tomorrowSunset) {
  const currentHourIndex = hourly.time.findIndex(t => new Date(t) >= cityNow);
  const forecastItems = [];
  const allHourTimes = [];

  // Collect sun events that should be shown
  const sunEvents = [];

  if (todaySunrise > cityNow) {
    sunEvents.push({
      time: todaySunrise, isSunrise: true, isSunset: false,
      iconUrl: `${METEOCONS_BASE}/sunrise.svg`,
      sunTime: formatSunTime(daily.sunrise[0])
    });
  }

  if (todaySunset > cityNow) {
    sunEvents.push({
      time: todaySunset, isSunrise: false, isSunset: true,
      iconUrl: `${METEOCONS_BASE}/sunset.svg`,
      sunTime: formatSunTime(daily.sunset[0])
    });
  }

  if (tomorrowSunrise && tomorrowSunrise > cityNow) {
    sunEvents.push({
      time: tomorrowSunrise, isSunrise: true, isSunset: false,
      iconUrl: `${METEOCONS_BASE}/sunrise.svg`,
      sunTime: formatSunTime(daily.sunrise[1])
    });
  }

  if (tomorrowSunset && tomorrowSunset > cityNow) {
    sunEvents.push({
      time: tomorrowSunset, isSunrise: false, isSunset: true,
      iconUrl: `${METEOCONS_BASE}/sunset.svg`,
      sunTime: formatSunTime(daily.sunset[1])
    });
  }

  sunEvents.sort((a, b) => a.time - b.time);

  // Build list of 12 hours
  for (let i = 0; i < 12 && (currentHourIndex + i) < hourly.time.length; i++) {
    const idx = currentHourIndex + i;
    const hourTime = new Date(hourly.time[idx]);
    const hourTemp = convertTemp(hourly.temperature_2m[idx]);
    const hourWeatherCode = hourly.weather_code[idx];
    const hourPrecipProb = hourly.precipitation_probability ? hourly.precipitation_probability[idx] : null;

    allHourTimes.push(hourTime);

    let hourIsNight = isNightTime(hourTime, todaySunrise, todaySunset);
    if (tomorrowSunrise && hourTime > todaySunset) {
      hourIsNight = hourTime < tomorrowSunrise;
    }

    forecastItems.push({
      time: hourTime, temp: hourTemp,
      iconUrl: getWeatherIconUrl(hourWeatherCode, hourIsNight),
      precipProb: hourPrecipProb, isSunrise: false, isSunset: false
    });
  }

  // Insert sun events in the correct positions
  for (const sunEvent of sunEvents) {
    let insertIndex = -1;
    for (let i = 0; i < forecastItems.length; i++) {
      const item = forecastItems[i];
      if (item.isSunrise || item.isSunset) continue;
      const hourStart = item.time;
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      if (sunEvent.time >= hourStart && sunEvent.time < hourEnd) {
        insertIndex = i + 1;
        break;
      }
    }
    if (insertIndex > 0) {
      forecastItems.splice(insertIndex, 0, {
        time: sunEvent.time, temp: null, iconUrl: sunEvent.iconUrl,
        isSunrise: sunEvent.isSunrise, isSunset: sunEvent.isSunset,
        sunTime: sunEvent.sunTime
      });
    }
  }

  return { forecastItems, allHourTimes };
}

// Render hourly forecast items to HTML
function buildHourlyForecastHTML(forecastItems) {
  return forecastItems.map((hour) => {
    const isSunEvent = hour.isSunrise || hour.isSunset;
    const timeLabel = isSunEvent ? (hour.isSunrise ? 'Sunrise' : 'Sunset') : formatHour(hour.time);
    const tempOrTime = isSunEvent ? hour.sunTime : `${hour.temp}°`;

    const precipHTML = (!isSunEvent && hour.precipProb !== null && hour.precipProb > 0)
      ? `<div class="weather-hour-precip"><img src="${METEOCONS_BASE}/raindrops.svg" class="precip-icon-small" alt="rain" />${hour.precipProb}%</div>`
      : '';

    return `
      <div class="weather-hour ${isSunEvent ? 'sun-event' : ''}">
        <div class="weather-hour-time">${timeLabel}</div>
        <img class="weather-hour-icon" src="${hour.iconUrl}" alt="weather" />
        <div class="weather-hour-temp">${tempOrTime}</div>
        ${precipHTML}
      </div>
    `;
  }).join('');
}

// Render tide section (bars, error, or placeholder)
function buildTideSectionHTML(tideData, allHourTimes) {
  let tideContent = '';
  let tideNextHTML = '';

  if (tideData && tideData.seaLevel && tideData.seaLevel.length > 0) {
    const tideHeights = getTideDataForHours(tideData, allHourTimes);
    const nextExtreme = getNextTideExtreme(tideData);
    const tideBarsHTML = generateTideHTML(tideHeights);

    if (nextExtreme) {
      const typeIcon = nextExtreme.type === 'high' ? '▲' : '▼';
      const typeLabel = nextExtreme.type === 'high' ? 'High' : 'Low';
      tideNextHTML = `<span class="tide-next">${typeIcon} ${typeLabel} ${formatPeriodTime(nextExtreme.time)}</span>`;
    }

    tideContent = `
      <div class="tide-wave-container">
        ${tideBarsHTML}
      </div>
    `;
  } else if (settings.stormglassApiKey && tideCache.error) {
    const errMsg = getStormglassErrorInfo(tideCache.error.code).uiMessage;
    tideContent = `<div class="tide-no-data">${errMsg}</div>`;
  } else if (settings.stormglassApiKey) {
    tideContent = `<div class="tide-no-data">Loading tides...</div>`;
  } else {
    tideContent = `<div class="tide-no-data">No tide data - Add Stormglass API key in settings</div>`;
  }

  return { tideContent, tideNextHTML };
}

// Render 16-day extended forecast grid
function buildExtendedForecastHTML(daily) {
  return daily.time.map((date, i) => {
    const dayDate = new Date(date);
    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayDate.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = dayDate.getDate();
    const maxT = convertTemp(daily.temperature_2m_max[i]);
    const minT = convertTemp(daily.temperature_2m_min[i]);
    const code = daily.weather_code[i];
    const precip = daily.precipitation_probability_max[i];
    const iconUrl = getWeatherIconUrl(code, false);

    return `
      <div class="forecast-day">
        <div class="forecast-day-name">${dayName}</div>
        <div class="forecast-day-num">${dayNum}</div>
        <img class="forecast-day-icon" src="${iconUrl}" alt="weather" />
        <div class="forecast-day-temps">
          <span class="forecast-max">${maxT}°</span>
          <span class="forecast-min">${minT}°</span>
        </div>
        ${precip > 0 ? `<div class="forecast-day-precip"><img src="${METEOCONS_BASE}/raindrops.svg" class="precip-icon-small" alt="rain" />${precip}%</div>` : ''}
      </div>
    `;
  }).join('');
}

function displayWeather(data, locationName, tideData = null, airQualityData = null, targetEl = null, cityLat = null, isGps = false) {
  const current = data.current;
  const daily = data.daily;
  const hourly = data.hourly;
  
  // Get timezone info from the response
  const cityTimezone = data.timezone;
  const cityUtcOffset = data.utc_offset_seconds || 0;
  
  const weatherCode = current.weather_code;
  const weatherInfo = weatherCodes[weatherCode] || { icon: 'not-available', description: 'Unknown' };
  
  const currentTemp = convertTemp(current.temperature_2m);
  const feelsLike = convertTemp(current.apparent_temperature);
  const maxTemp = convertTemp(daily.temperature_2m_max[0]);
  const minTemp = convertTemp(daily.temperature_2m_min[0]);
  const dailyPrecipProb = daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : null;
  const unit = getTempUnit();
  const pressure = current.pressure_msl;
  
  // Additional weather data
  const humidity = current.relative_humidity_2m;
  const windSpeed = Math.round(current.wind_speed_10m);
  const windGusts = current.wind_gusts_10m ? Math.round(current.wind_gusts_10m) : null;
  const windDeg = current.wind_direction_10m;
  const windDir = getWindDirection(windDeg);
  const uvIndex = current.uv_index !== undefined ? Math.round(current.uv_index) : null;
  const cloudCover = current.cloud_cover !== undefined ? current.cloud_cover : null;
  const visibility = current.visibility !== undefined ? current.visibility : null; // in meters
  
  // Air quality data
  let aqi = null;
  let aqiRating = null;
  let aqiDetails = null;
  if (airQualityData && airQualityData.current) {
    aqi = airQualityData.current.european_aqi;
    aqiRating = getAQIRating(aqi);
    aqiDetails = {
      pm25: airQualityData.current.pm2_5,
      pm10: airQualityData.current.pm10,
      o3: airQualityData.current.ozone,
      no2: airQualityData.current.nitrogen_dioxide,
      so2: airQualityData.current.sulphur_dioxide,
      co: airQualityData.current.carbon_monoxide
    };
  }
  
  // Get sunrise and sunset times (today and tomorrow for night handling)
  const now = new Date();
  
  // For cities in different timezones, we need to know "now" in their timezone
  // The hourly.time values are already in the city's local timezone
  // So we need to get the current hour in the city's timezone for proper comparison
  let cityNow = now;
  if (cityTimezone) {
    try {
      // Get current time string in city's timezone and parse it
      const cityTimeStr = now.toLocaleString('en-US', { timeZone: cityTimezone });
      cityNow = new Date(cityTimeStr);
    } catch (e) {
      console.log('Error converting timezone:', e);
    }
  }
  
  const todaySunrise = new Date(daily.sunrise[0]);
  const todaySunset = new Date(daily.sunset[0]);
  const tomorrowSunrise = daily.sunrise[1] ? new Date(daily.sunrise[1]) : null;
  const tomorrowSunset = daily.sunset[1] ? new Date(daily.sunset[1]) : null;
  
  const isNight = isNightTime(cityNow, todaySunrise, todaySunset);
  
  // Get moon phase
  const moonPhase = getMoonPhase(cityNow);
  
  // Calculate fishing score (now includes tide data)
  const fishingScore = calculateFishingScore(cityNow, moonPhase, todaySunrise, todaySunset, pressure, tideData);
  const fishingRating = getFishingRating(fishingScore);
  
  // Get solunar periods
  const solunarPeriods = getSolunarPeriods(cityNow, todaySunrise, todaySunset);
  const nextPeriod = solunarPeriods.find(p => p.end > cityNow);
  
  // Build forecast data and HTML via helper functions
  const { forecastItems, allHourTimes } = buildHourlyForecastItems(
    hourly, cityNow, daily, todaySunrise, todaySunset, tomorrowSunrise, tomorrowSunset
  );
  const hourlyHTML = buildHourlyForecastHTML(forecastItems);
  const { tideContent, tideNextHTML } = buildTideSectionHTML(tideData, allHourTimes);
  const extendedHTML = buildExtendedForecastHTML(daily);
  
  // Build the 3D cube with three faces (Tides, Extended, Alerts)
  const tideHTML = `
    <div class="cube-container">
      <div class="cube" id="tideForecastCube" data-face="tides">
        <div class="cube-face cube-face-tides">
          <div class="cube-header">
            <div class="cube-header-left">
              <span class="cube-tab active" data-face="tides">🌊 Tides</span>
              <span class="cube-tab" data-face="forecast">📅 Extended</span>
              <span class="cube-tab" data-face="alerts">🚨 Alerts</span>
            </div>
            ${tideNextHTML}
          </div>
          ${tideContent}
        </div>
        <div class="cube-face cube-face-forecast">
          <div class="cube-header">
            <div class="cube-header-left">
              <span class="cube-tab" data-face="tides">🌊 Tides</span>
              <span class="cube-tab active" data-face="forecast">📅 Extended</span>
              <span class="cube-tab" data-face="alerts">🚨 Alerts</span>
            </div>
          </div>
          <div class="forecast-scroll">
            ${extendedHTML}
          </div>
        </div>
        <div class="cube-face cube-face-alerts">
          <div class="cube-header">
            <div class="cube-header-left">
              <span class="cube-tab" data-face="tides">🌊 Tides</span>
              <span class="cube-tab" data-face="forecast">📅 Extended</span>
              <span class="cube-tab active" data-face="alerts">🚨 Alerts</span>
            </div>
          </div>
          <div class="alerts-content">
            <div class="alerts-loading">Loading alerts...</div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Build next period info
  let periodHTML = '';
  if (nextPeriod) {
    const isActive = now >= nextPeriod.start && now <= nextPeriod.end;
    periodHTML = isActive 
      ? `<span class="period-active">● ${nextPeriod.label} NOW</span>`
      : `${nextPeriod.label}: ${formatPeriodTime(nextPeriod.start)}`;
  }
  
  // Build AQI details row if enabled
  let aqiDetailsHTML = '';
  if (settings.showAqiDetails && aqiDetails) {
    aqiDetailsHTML = `
      <div class="aqi-details-row">
        <span class="aqi-detail">PM2.5: ${aqiDetails.pm25?.toFixed(1) || '-'}</span>
        <span class="aqi-detail">PM10: ${aqiDetails.pm10?.toFixed(1) || '-'}</span>
        <span class="aqi-detail">O₃: ${aqiDetails.o3?.toFixed(1) || '-'}</span>
        <span class="aqi-detail">NO₂: ${aqiDetails.no2?.toFixed(1) || '-'}</span>
        <span class="aqi-detail">SO₂: ${aqiDetails.so2?.toFixed(1) || '-'}</span>
        <span class="aqi-detail">CO: ${aqiDetails.co?.toFixed(0) || '-'}</span>
      </div>
    `;
  }
  
  // Get UV level info
  const uvLevel = uvIndex !== null ? getUVLevel(uvIndex) : null;
  
  // Only show feels like if different from actual temp
  const showFeelsLike = Math.abs(currentTemp - feelsLike) >= 2;
  
  const weatherEl = targetEl || document.createElement('div');
  const southernHemisphere = (cityLat !== null ? cityLat : settings.lat) < 0;
  
  // Generate local time HTML for non-GPS cities with different timezone
  let localTimeHTML = '';
  if (!isGps && cityTimezone && isDifferentTimezone(cityTimezone)) {
    const cityTimeInfo = getCityLocalTime(cityTimezone);
    if (cityTimeInfo) {
      localTimeHTML = `<div class="city-local-time">${cityTimeInfo.time}${cityTimeInfo.dayDiff ? `<span class="day-diff">${cityTimeInfo.dayDiff}</span>` : ''}</div>`;
    }
  }
  
  // Generate city action buttons for non-GPS cities
  let cityActionsHTML = '';
  if (!isGps && weatherEl.dataset.cityIndex !== undefined) {
    const cityIndex = parseInt(weatherEl.dataset.cityIndex);
    const city = settings.savedCities[cityIndex];
    const alertsOn = city?.alertsEnabled !== false; // Default true
    const bellIcon = alertsOn ? '🔔' : '🔕';
    const bellTitle = alertsOn ? 'Alerts enabled (click to disable)' : 'Alerts disabled (click to enable)';
    
    cityActionsHTML = `
      <div class="city-actions">
        <button class="city-alert-btn ${alertsOn ? 'alerts-on' : 'alerts-off'}" data-toggle-alerts="${cityIndex}" title="${bellTitle}">${bellIcon}</button>
        <button class="remove-city-btn" data-remove-city="${cityIndex}" title="Remove city">✕</button>
      </div>
    `;
  }
  
  weatherEl.innerHTML = `
    ${cityActionsHTML}
    <div class="weather-top">
      <div class="weather-top-left">
        <div class="weather-city" title="${locationName || 'Unknown Location'}">${locationName || 'Unknown Location'}</div>
        <div class="weather-temp-main">${currentTemp}${unit}</div>
        ${showFeelsLike ? `<div class="weather-feels-like">Feels like ${feelsLike}°</div>` : ''}
        <div class="weather-minmax">
          H: ${maxTemp}° L: ${minTemp}°
          ${dailyPrecipProb !== null && dailyPrecipProb > 0 ? `<span class="daily-precip"><img src="${METEOCONS_BASE}/raindrops.svg" class="precip-icon" alt="rain" />${dailyPrecipProb}%</span>` : ''}
        </div>
      </div>
      <div class="weather-top-center">
        ${localTimeHTML}
        <div class="weather-condition">
          <img class="weather-condition-icon" src="${getWeatherIconUrl(weatherCode, isNight)}" alt="weather" />
          <span class="weather-condition-text">${weatherInfo.description}</span>
        </div>
      </div>
      <div class="weather-top-right">
        <div class="weather-stats-columns">
          <div class="weather-stats-left">
            <div class="weather-stat">
              <span class="stat-icon">◉</span> ${Math.round(pressure)} hPa
            </div>
            <div class="weather-stat">
              <img src="${METEOCONS_BASE}/humidity.svg" class="stat-icon-img" alt="humidity" /> ${humidity}%
            </div>
            ${cloudCover !== null ? `
            <div class="weather-stat">
              ☁️ ${cloudCover}%
            </div>
            ` : ''}
            ${visibility !== null ? `
            <div class="weather-stat">
              👁️ ${visibility >= 1000 ? (visibility / 1000).toFixed(1) + ' km' : visibility + ' m'}
            </div>
            ` : ''}
          </div>
          <div class="weather-stats-divider"></div>
          <div class="weather-stats-right">
            ${uvIndex !== null ? `
            <div class="weather-stat weather-uv">
              <img class="stat-icon-img" src="${getUVIndexIcon(uvIndex)}" alt="UV" />
              <span style="color: ${uvLevel.color}">UV ${uvIndex}</span>
            </div>
            ` : ''}
            <div class="weather-stat weather-wind">
              <img class="stat-icon-img" src="${getWindBeaufortIcon(windSpeed)}" alt="wind" />
              <span>${getWindArrow(windDeg)} ${windSpeed} km/h</span>
            </div>
            ${windGusts !== null ? `
            <div class="weather-stat">
              💨 ${windGusts} km/h
            </div>
            ` : ''}
            ${aqi !== null ? `
            <div class="weather-stat">
              <span class="aqi-badge" style="background: ${aqiRating.color}20; color: ${aqiRating.color}">AQI ${Math.round(aqi)}</span>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
    ${aqiDetailsHTML}
    <div class="weather-hourly">
      ${hourlyHTML}
    </div>
    ${tideHTML}
    <div class="weather-bottom">
      <div class="moon-info">
        <img class="moon-icon ${southernHemisphere ? 'southern-hemisphere' : ''}" src="${moonPhase.iconUrl}" alt="moon" />
        <div class="moon-details">
          <div class="moon-phase-name">${moonPhase.phaseName}</div>
          <div class="moon-illumination">${moonPhase.illumination}% illuminated</div>
        </div>
      </div>
      <div class="fishing-info">
        <div class="fishing-rating" style="color: ${fishingRating.color}">
          <span class="fishing-fish">${fishingRating.fish}</span>
          <span class="fishing-label">${fishingRating.rating}</span>
        </div>
        <div class="fishing-period">${periodHTML}</div>
      </div>
    </div>
  `;
}

// Display error
function displayWeatherError(message, targetEl = null) {
  const weatherEl = targetEl || document.createElement('div');
  weatherEl.innerHTML = `<div class="weather-error">⚠️ ${message}</div>`;
}

// ============================================
// CAROUSEL & MULTI-CITY LOGIC
// ============================================

function buildCarousel() {
  const track = document.getElementById('carouselTrack');
  const dots = document.getElementById('carouselDots');
  
  // Build slides: GPS + saved cities + add button
  const totalSlides = 1 + settings.savedCities.length + 1; // GPS + cities + add
  
  let slidesHTML = '';
  let dotsHTML = '';
  
  // Slide 0: GPS location
  slidesHTML += `<div class="carousel-slide"><div class="weather-widget" id="weather-gps"><div class="weather-loading">Loading weather...</div></div></div>`;
  dotsHTML += `<div class="carousel-dot dot-gps ${currentSlide === 0 ? 'active' : ''}" data-slide="0"></div>`;
  
  // Saved city slides
  settings.savedCities.forEach((city, i) => {
    const slideIdx = i + 1;
    slidesHTML += `<div class="carousel-slide"><div class="weather-widget" id="weather-city-${i}" data-city-index="${i}" style="position:relative"><div class="weather-loading">Loading weather...</div></div></div>`;
    dotsHTML += `<div class="carousel-dot ${currentSlide === slideIdx ? 'active' : ''}" data-slide="${slideIdx}"></div>`;
  });
  
  // Add city slide (only if under limit)
  if (settings.savedCities.length < MAX_CITIES) {
    const addIdx = settings.savedCities.length + 1;
    slidesHTML += `
      <div class="carousel-slide">
        <div class="add-city-slide weather-widget" id="addCitySlide">
          <div class="add-city-icon" id="addCityBtn">＋</div>
          <div class="add-city-label">Add City</div>
          <div class="city-search-container" id="citySearchContainer">
            <input type="text" class="city-search-input" id="citySearchInput" placeholder="Search city..." autocomplete="off" />
            <div class="city-search-results" id="citySearchResults"></div>
          </div>
        </div>
      </div>`;
    dotsHTML += `<div class="carousel-dot dot-add ${currentSlide === addIdx ? 'active' : ''}" data-slide="${addIdx}"></div>`;
  }
  
  track.innerHTML = slidesHTML;
  dots.innerHTML = dotsHTML;
  
  // Ensure currentSlide is within bounds
  const maxSlide = totalSlides - 1;
  if (currentSlide > maxSlide) currentSlide = maxSlide;
  
  updateCarouselPosition(false);
  setupCarouselEvents();
  setupArrowEvents();
}

function updateCarouselPosition(animate = true) {
  const track = document.getElementById('carouselTrack');
  if (!track) return;
  track.style.transition = animate ? 'transform 0.35s ease' : 'none';
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
  
  // Update dots
  document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentSlide);
  });
  
  // Update active slide class
  document.querySelectorAll('.carousel-slide').forEach((slide, i) => {
    slide.classList.toggle('active', i === currentSlide);
  });
  
  // Update arrow visibility
  const totalSlides = 1 + settings.savedCities.length + (settings.savedCities.length < MAX_CITIES ? 1 : 0);
  const prevArrow = document.getElementById('carouselPrev');
  const nextArrow = document.getElementById('carouselNext');
  if (prevArrow) prevArrow.classList.toggle('visible', currentSlide > 0);
  if (nextArrow) nextArrow.classList.toggle('visible', currentSlide < totalSlides - 1);
  
  // Center nav zones vertically based on current slide's widget height
  updateNavZonePosition();
}

function updateNavZonePosition() {
  const slides = document.querySelectorAll('.carousel-slide');
  const currentSlideEl = slides[currentSlide];
  if (!currentSlideEl) return;
  
  const widget = currentSlideEl.querySelector('.weather-widget, .add-city-slide');
  if (!widget) return;
  
  const widgetHeight = widget.offsetHeight;
  const navZoneHeight = 80;
  const topPosition = (widgetHeight - navZoneHeight) / 2;
  
  const prevArrow = document.getElementById('carouselPrev');
  const nextArrow = document.getElementById('carouselNext');
  
  if (prevArrow) prevArrow.style.top = `${topPosition}px`;
  if (nextArrow) nextArrow.style.top = `${topPosition}px`;
}

function goToSlide(index) {
  const totalSlides = 1 + settings.savedCities.length + (settings.savedCities.length < MAX_CITIES ? 1 : 0);
  currentSlide = Math.max(0, Math.min(index, totalSlides - 1));
  updateCarouselPosition(true);
  
  // Load alerts for the new slide if the alerts tab is active
  setTimeout(() => {
    const activeSlide = document.querySelector('.carousel-slide.active');
    if (activeSlide) {
      const cube = activeSlide.querySelector('.cube');
      if (cube && cube.classList.contains('show-alerts')) {
        loadAlerts();
      }
    }
  }, 100);
}

// Arrow click handlers
let arrowEventsAdded = false;

function setupArrowEvents() {
  if (arrowEventsAdded) return;
  arrowEventsAdded = true;
  
  const prevArrow = document.getElementById('carouselPrev');
  const nextArrow = document.getElementById('carouselNext');
  
  if (prevArrow) {
    prevArrow.addEventListener('click', () => goToSlide(currentSlide - 1));
  }
  if (nextArrow) {
    nextArrow.addEventListener('click', () => goToSlide(currentSlide + 1));
  }
}

let carouselGlobalEventsAdded = false;

function setupCarouselEvents() {
  // Dot clicks
  document.querySelectorAll('.carousel-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      goToSlide(parseInt(dot.dataset.slide));
    });
  });
  
  // Only add global events once
  if (!carouselGlobalEventsAdded) {
    carouselGlobalEventsAdded = true;
    
    // Swipe support
    const carousel = document.getElementById('weatherCarousel');
    let startX = 0, startY = 0, isDragging = false;
    
    carousel.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });
    
    carousel.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      isDragging = false;
      const diffX = e.changedTouches[0].clientX - startX;
      const diffY = Math.abs(e.changedTouches[0].clientY - startY);
      if (Math.abs(diffX) > 50 && diffY < 100) {
        if (diffX < 0) goToSlide(currentSlide + 1);
        else goToSlide(currentSlide - 1);
      }
    }, { passive: true });
    
    // Mouse drag support for desktop
    carousel.addEventListener('mousedown', (e) => {
      if (e.target.closest('.city-search-container, .remove-city-btn, .add-city-icon, .weather-hourly, .tide-chart')) return;
      startX = e.clientX;
      startY = e.clientY;
      isDragging = true;
      e.preventDefault();
    });
    
    document.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      const diffX = e.clientX - startX;
      const diffY = Math.abs(e.clientY - startY);
      if (Math.abs(diffX) > 50 && diffY < 100) {
        if (diffX < 0) goToSlide(currentSlide + 1);
        else goToSlide(currentSlide - 1);
      }
    });
    
    // Keyboard arrows
    document.addEventListener('keydown', (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft') goToSlide(currentSlide - 1);
      if (e.key === 'ArrowRight') goToSlide(currentSlide + 1);
    });
  }
  
  // Add city button
  const addBtn = document.getElementById('addCityBtn');
  const searchContainer = document.getElementById('citySearchContainer');
  const searchInput = document.getElementById('citySearchInput');
  
  if (addBtn && searchContainer && searchInput) {
    addBtn.addEventListener('click', () => {
      searchContainer.classList.add('active');
      addBtn.style.display = 'none';
      document.querySelector('.add-city-label').style.display = 'none';
      searchInput.focus();
    });
    
    let searchTimeout = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        const query = searchInput.value.trim();
        const results = await searchCities(query);
        const resultsEl = document.getElementById('citySearchResults');
        if (results.length === 0) {
          resultsEl.innerHTML = query.length >= 2 ? '<div class="city-search-result"><div class="city-result-name" style="opacity:0.5">No results found</div></div>' : '';
          return;
        }
        resultsEl.innerHTML = results.map((r, i) => `
          <div class="city-search-result" data-result-index="${i}">
            <div class="city-result-name">${r.name}</div>
            <div class="city-result-detail">${[r.admin1, r.country].filter(Boolean).join(', ')}</div>
          </div>
        `).join('');
        
        // Click handlers for results
        resultsEl.querySelectorAll('.city-search-result').forEach(el => {
          el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.resultIndex);
            const city = results[idx];
            if (!city) return;
            addCity(city);
          });
        });
      }, 300);
    });
    
    // Close search on escape
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchContainer.classList.remove('active');
        addBtn.style.display = '';
        document.querySelector('.add-city-label').style.display = '';
        searchInput.value = '';
        document.getElementById('citySearchResults').innerHTML = '';
      }
    });
  }
  
  // Remove city buttons
  document.querySelectorAll('.remove-city-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.cityIndex);
      removeCity(idx);
    });
  });
}

function addCity(cityData) {
  if (settings.savedCities.length >= MAX_CITIES) return;
  
  // Avoid duplicates
  const exists = settings.savedCities.some(c => 
    Math.abs(c.lat - cityData.lat) < 0.01 && Math.abs(c.lon - cityData.lon) < 0.01
  );
  if (exists) return;
  
  settings.savedCities.push({
    name: cityData.displayName || cityData.name,
    lat: cityData.lat,
    lon: cityData.lon
  });
  saveSettings();
  
  // Go to the newly added city slide
  currentSlide = settings.savedCities.length; // The new city's index
  buildCarousel();
  loadAllWeather();
}

function removeCity(index) {
  if (index < 0 || index >= settings.savedCities.length) return;
  
  const cityName = settings.savedCities[index].name;
  if (!confirm(`Remove ${cityName}?`)) return;
  
  settings.savedCities.splice(index, 1);
  saveSettings();
  
  // Adjust currentSlide if needed
  if (currentSlide > settings.savedCities.length) {
    currentSlide = settings.savedCities.length;
  }
  buildCarousel();
  loadAllWeather();
}

// Toggle alerts for a saved city
function toggleCityAlerts(index) {
  if (index < 0 || index >= settings.savedCities.length) return;
  
  const city = settings.savedCities[index];
  city.alertsEnabled = city.alertsEnabled === false ? true : false; // Toggle, default is true
  saveSettings();
  cacheLocationForAlerts();
  
  // Update the button in place without full reload
  const btn = document.querySelector(`.city-alert-btn[data-toggle-alerts="${index}"]`);
  if (btn) {
    const alertsOn = city.alertsEnabled !== false;
    btn.textContent = alertsOn ? '🔔' : '🔕';
    btn.title = alertsOn ? 'Alerts enabled (click to disable)' : 'Alerts disabled (click to enable)';
    btn.classList.toggle('alerts-on', alertsOn);
    btn.classList.toggle('alerts-off', !alertsOn);
  }
}

// Delegated event listener for remove city buttons and cube tabs
document.addEventListener('click', (e) => {
  // Remove city button
  const removeBtn = e.target.closest('.remove-city-btn[data-remove-city]');
  if (removeBtn) {
    const index = parseInt(removeBtn.dataset.removeCity);
    removeCity(index);
    return;
  }
  
  // Toggle alerts for city
  const alertToggleBtn = e.target.closest('.city-alert-btn[data-toggle-alerts]');
  if (alertToggleBtn) {
    const index = parseInt(alertToggleBtn.dataset.toggleAlerts);
    toggleCityAlerts(index);
    return;
  }
  
  // Cube tab for switching tides/forecast/alerts
  const cubeTab = e.target.closest('.cube-tab');
  if (cubeTab) {
    const face = cubeTab.dataset.face;
    const cube = cubeTab.closest('.cube');
    if (cube && face) {
      // Remove all face classes
      cube.classList.remove('show-forecast', 'show-alerts');
      cube.dataset.face = face;
      
      // Add appropriate class
      if (face === 'forecast') {
        cube.classList.add('show-forecast');
      } else if (face === 'alerts') {
        cube.classList.add('show-alerts');
        // Load alerts when showing alerts face
        loadAlerts();
      }
    }
  }
  
  // Dismiss alert banner
  const dismissBtn = e.target.closest('.alert-banner-dismiss');
  if (dismissBtn) {
    const banner = document.getElementById('alertBanner');
    if (banner) banner.classList.remove('visible');
  }
});

// Load weather for a specific location into a target element
async function loadLocationWeather(lat, lon, locationName, targetEl, isGps = false) {
  try {
    const [weatherData, tideData, airQualityData] = await Promise.all([
      fetchWeather(lat, lon),
      settings.stormglassApiKey ? fetchTideData(lat, lon) : Promise.resolve(null),
      fetchAirQuality(lat, lon)
    ]);
    
    displayWeather(weatherData, locationName, tideData, airQualityData, targetEl, lat, isGps);
    
    // Update nav zone position after content loads
    setTimeout(updateNavZonePosition, 50);
  } catch (error) {
    console.error(`Weather error for ${locationName}:`, error);
    displayWeatherError('Could not load weather data.', targetEl);
  }
}

// Main weather loading function - loads all locations
async function loadAllWeather() {
  // Load GPS location (slide 0)
  const gpsEl = document.getElementById('weather-gps');
  if (gpsEl) {
    gpsEl.innerHTML = '<div class="weather-loading">Loading weather...</div>';
    try {
      let lat = settings.lat;
      let lon = settings.lon;
      let locationName = settings.locationName;
      
      if (!lat || !lon) {
        const location = await getLocation();
        lat = location.lat;
        lon = location.lon;
        settings.lat = lat;
        settings.lon = lon;
        locationName = await getLocationName(lat, lon);
        settings.locationName = locationName;
        saveSettings();
      }
      
      loadLocationWeather(lat, lon, locationName, gpsEl, true);
    } catch (error) {
      console.error('GPS error:', error);
      if (error.code === 1) {
        displayWeatherError('Location access denied. Please enable location permissions.', gpsEl);
      } else {
        displayWeatherError('Could not determine location.', gpsEl);
      }
    }
  }
  
  // Load saved cities
  settings.savedCities.forEach((city, i) => {
    const cityEl = document.getElementById(`weather-city-${i}`);
    if (cityEl) {
      cityEl.innerHTML = '<div class="weather-loading">Loading weather...</div>';
      loadLocationWeather(city.lat, city.lon, city.name, cityEl);
    }
  });
}

// Keep backward compat for settings change handlers
function loadWeather() {
  buildCarousel();
  loadAllWeather();
}

// Settings panel toggle
document.getElementById('settingsBtn').addEventListener('click', () => {
  document.getElementById('settingsPanel').classList.toggle('active');
});

// Close settings when clicking outside
document.addEventListener('click', (e) => {
  const panel = document.getElementById('settingsPanel');
  const btn = document.getElementById('settingsBtn');
  if (!panel.contains(e.target) && e.target !== btn) {
    panel.classList.remove('active');
  }
});

// Settings change handlers
document.getElementById('unitSelect').addEventListener('change', (e) => {
  settings.unit = e.target.value;
  saveSettings();
  loadWeather();
});

document.getElementById('timeFormat').addEventListener('change', (e) => {
  settings.timeFormat = e.target.value;
  saveSettings();
  updateClock();
  loadWeather();
});

document.getElementById('showSeconds').addEventListener('change', (e) => {
  settings.showSeconds = e.target.value === 'true';
  saveSettings();
  updateClock();
});

document.getElementById('weatherModel').addEventListener('change', (e) => {
  settings.weatherModel = e.target.value;
  saveSettings();
  loadWeather();
});

document.getElementById('refreshWeather').addEventListener('click', () => {
  settings.lat = null;
  settings.lon = null;
  settings.locationName = null;
  saveSettings();
  loadWeather();
});

// Stormglass API key handler
document.getElementById('stormglassApiKey').addEventListener('change', (e) => {
  settings.stormglassApiKey = e.target.value.trim();
  // Clear tide cache when API key changes
  tideCache = { data: null, date: null, lat: null, lon: null, error: null };
  saveSettings();
  saveTideCache();
  loadWeather();
});

// AQI details toggle handler
document.getElementById('showAqiDetails').addEventListener('change', (e) => {
  settings.showAqiDetails = e.target.value === 'true';
  saveSettings();
  loadWeather();
});

// Alert settings handlers
document.getElementById('alertsEnabled').addEventListener('change', (e) => {
  settings.alertsEnabled = e.target.value === 'true';
  saveSettings();
  cacheLocationForAlerts();
});

document.getElementById('alertLevel').addEventListener('change', (e) => {
  settings.alertLevel = e.target.value;
  saveSettings();
  cacheLocationForAlerts();
});

// Theme selection handlers
document.querySelectorAll('.theme-option').forEach(el => {
  el.addEventListener('click', () => {
    const theme = el.dataset.theme;
    settings.theme = theme;
    applyTheme(theme);
    saveSettings();
  });
});

// ============================================
// EARTHQUAKE ALERTS FUNCTIONS
// ============================================

// Alert emoji constants (shared by loadAlerts and showAlertBanner)
const ALERT_TYPE_EMOJIS = {
  earthquake: '🌍',
  tsunami: '🌊',
  volcano: '🌋',
  hurricane: '🌀',
  wildfire: '🔥',
  tornado: '🌪️',
  severe_weather: '⛈️'
};

const ALERT_LEVEL_EMOJIS = {
  critical: '🔴',
  high: '🟠',
  moderate: '🟡',
  info: 'ℹ️'
};

// Filter alerts by city, age, deduplicate, sort, validate, and limit to 10
function filterAndDeduplicateAlerts(alerts, cityName) {
  let filtered = cityName
    ? alerts.filter(a => a.locationName === cityName)
    : alerts;

  // Filter out old alerts (more than 6 hours for weather, 24h for earthquakes)
  const now = Date.now();
  filtered = filtered.filter(a => {
    const ageHours = (now - a.time) / (1000 * 60 * 60);
    if (a.type === 'earthquake') return ageHours < 24;
    return ageHours < 6;
  });

  // Deduplicate by type + headline
  const seenKeys = new Set();
  filtered = filtered.filter(a => {
    const key = `${a.type}-${a.eventType || ''}-${a.severity || ''}-${a.source || ''}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  // Sort by time (newest first), validate, and limit
  filtered.sort((a, b) => b.time - a.time);
  return filtered.filter(a => a.type && a.id).slice(0, 10);
}

// Render a single alert item to HTML
function renderAlertItem(alert) {
  const levelClass = `alert-level-${alert.alertLevel}`;
  const levelEmoji = ALERT_LEVEL_EMOJIS[alert.alertLevel] || 'ℹ️';
  const typeEmoji = ALERT_TYPE_EMOJIS[alert.type] || '⚠️';
  const timeAgo = formatAlertTimeAgo(alert.time);

  // Build magnitude/intensity display based on type
  let intensityDisplay = '';
  if (alert.type === 'earthquake' && alert.magnitude !== undefined) {
    intensityDisplay = `M${alert.magnitude.toFixed(1)}`;
  } else if (alert.type === 'hurricane') {
    intensityDisplay = alert.name || 'Storm';
  } else if (alert.type === 'severe_weather') {
    intensityDisplay = alert.severity || 'Weather Alert';
  } else if (alert.type) {
    intensityDisplay = alert.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  } else {
    intensityDisplay = 'Alert';
  }

  // Build details based on type
  let detailsHTML = '';
  if (alert.type === 'earthquake') {
    detailsHTML = `<span>${alert.distanceKm} km from ${alert.locationName || 'you'}</span>`;
    const mmiDesc = getMmiDescription(alert.localMMI);
    detailsHTML += `<span>•</span><span>Depth: ${alert.depth}km</span><span>•</span><span>Felt: ${mmiDesc}</span>`;
  } else if (alert.type === 'severe_weather') {
    const eventLabel = alert.eventType ? alert.eventType.replace(/_/g, ' ') : '';
    detailsHTML = `<span>${alert.source || 'Weather Service'}</span>`;
    if (eventLabel && eventLabel !== 'weather') {
      detailsHTML += `<span>•</span><span>${eventLabel}</span>`;
    }
  } else if (alert.distanceKm !== undefined) {
    detailsHTML = `<span>${alert.distanceKm} km from ${alert.locationName || 'you'}</span>`;
  } else {
    detailsHTML = `<span>${alert.source || alert.locationName || ''}</span>`;
  }

  return `
    <div class="alert-item ${levelClass}" data-id="${alert.id}">
      <div class="alert-item-header">
        <span class="alert-item-mag">${levelEmoji} ${typeEmoji} ${intensityDisplay}</span>
        <span class="alert-item-time">${timeAgo}</span>
      </div>
      <div class="alert-item-place">${alert.place || 'Unknown location'}</div>
      <div class="alert-item-details">
        ${detailsHTML}
      </div>
      ${alert.tsunami ? '<div class="alert-item-tsunami">⚠️ Tsunami Warning</div>' : ''}
    </div>
  `;
}

// Load alerts from background service worker
async function loadAlerts() {
  const activeSlide = document.querySelector('.carousel-slide.active');
  const alertsContent = activeSlide ?
    activeSlide.querySelector('.alerts-content') :
    document.querySelector('.alerts-content');

  if (!alertsContent) return;

  let currentCityName = null;
  if (currentSlide === 0) {
    currentCityName = settings.locationName || 'Current Location';
  } else if (settings.savedCities && settings.savedCities[currentSlide - 1]) {
    currentCityName = settings.savedCities[currentSlide - 1].name;
  }

  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAlerts' });
    const alerts = response?.alerts || [];
    const recentAlerts = filterAndDeduplicateAlerts(alerts, currentCityName);

    if (recentAlerts.length === 0) {
      alertsContent.innerHTML = `
        <div class="alerts-empty">
          <div class="alerts-empty-icon">✓</div>
          <div class="alerts-empty-text">No recent alerts for ${currentCityName || 'this location'}</div>
          <div class="alerts-empty-sub">Monitoring earthquakes worldwide + regional alerts</div>
        </div>
      `;
      return;
    }

    alertsContent.innerHTML = `
      <div class="alerts-scroll">${recentAlerts.map(renderAlertItem).join('')}</div>
    `;

  } catch (err) {
    console.error('Error loading alerts:', err);
    alertsContent.innerHTML = `
      <div class="alerts-empty">
        <div class="alerts-empty-text">Could not load alerts</div>
        <div class="alerts-empty-sub">Make sure extension permissions are granted</div>
      </div>
    `;
  }
}

// Format time ago for alerts
function formatAlertTimeAgo(timestamp) {
  const minutes = (Date.now() - timestamp) / 60000;
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

// Get MMI description
function getMmiDescription(mmi) {
  if (!mmi || mmi < 2) return 'Not felt';
  if (mmi < 3) return 'Weak';
  if (mmi < 4) return 'Light';
  if (mmi < 5) return 'Moderate';
  if (mmi < 6) return 'Strong';
  if (mmi < 7) return 'Very Strong';
  if (mmi < 8) return 'Severe';
  if (mmi < 9) return 'Violent';
  return 'Extreme';
}

// Show alert banner for critical/high alerts
function showAlertBanner(alert) {
  let banner = document.getElementById('alertBanner');
  
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'alertBanner';
    banner.className = 'alert-banner';
    document.body.appendChild(banner);
  }
  
  const levelClass = `alert-banner-${alert.alertLevel}`;
  const levelEmoji = ALERT_LEVEL_EMOJIS[alert.alertLevel] || '🟡';
  const typeEmoji = ALERT_TYPE_EMOJIS[alert.type] || '⚠️';
  
  const timeAgo = formatAlertTimeAgo(alert.time);
  
  // Build title based on type
  let title = '';
  if (alert.type === 'earthquake') {
    title = `${typeEmoji} M${alert.magnitude.toFixed(1)} Earthquake`;
  } else if (alert.type === 'hurricane') {
    title = `${typeEmoji} ${alert.name || 'Hurricane'}`;
  } else if (alert.type === 'tsunami') {
    title = `${typeEmoji} Tsunami Warning`;
  } else if (alert.type === 'volcano') {
    title = `${typeEmoji} Volcanic Activity`;
  } else if (alert.type === 'wildfire') {
    title = `${typeEmoji} Wildfire Alert`;
  } else {
    title = `${typeEmoji} ${alert.type || 'Alert'}`;
  }
  
  banner.className = `alert-banner ${levelClass} visible`;
  banner.innerHTML = `
    <div class="alert-banner-content">
      <span class="alert-banner-icon">${levelEmoji}</span>
      <div class="alert-banner-text">
        <div class="alert-banner-title">${title} - ${alert.distanceKm}km from ${alert.locationName || 'you'}</div>
        <div class="alert-banner-sub">${alert.place || 'Unknown'} • ${timeAgo}</div>
      </div>
      <button class="alert-banner-dismiss">✕</button>
    </div>
  `;
}

// Check for new alerts periodically
async function checkForNewAlerts() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAlerts' });
    const alerts = response?.alerts || [];
    
    // Find alerts from the last 10 minutes that are high/critical
    const recentCritical = alerts.filter(a => {
      const minutesAgo = (Date.now() - a.time) / 60000;
      return minutesAgo < 10 && (a.alertLevel === 'critical' || a.alertLevel === 'high');
    });
    
    if (recentCritical.length > 0) {
      // Show banner for the most relevant one
      const mostRelevant = recentCritical.reduce((a, b) => 
        a.relevance > b.relevance ? a : b
      );
      showAlertBanner(mostRelevant);
    }
  } catch (err) {
    // Silently fail - background might not be ready
  }
}

// Cache user location for background service
async function cacheLocationForAlerts() {
  if (settings.lat && settings.lon) {
    await chrome.storage.local.set({
      weatherClockSettings: {
        ...settings,
        cachedLat: settings.lat,
        cachedLon: settings.lon,
        alertsEnabled: settings.alertsEnabled !== false,
        alertLevel: settings.alertLevel || 'medium'
      }
    });
  }
}

// Initialize
async function init() {
  await loadSettings();
  updateClock();
  setInterval(updateClock, 1000);
  buildCarousel();
  loadAllWeather();
  setInterval(() => loadAllWeather(), 15 * 60 * 1000);
  
  // Alert system initialization - trigger check immediately
  setTimeout(async () => {
    await cacheLocationForAlerts();
    // Trigger immediate check in background worker
    try {
      await chrome.runtime.sendMessage({ action: 'checkNow' });
    } catch (e) {
      console.log('Weather Clock: Background not ready, will retry');
    }
    checkForNewAlerts();
  }, 1000); // Reduced from 2000 to 1000
  
  // Check for alerts periodically
  setInterval(checkForNewAlerts, 30000); // Every 30 seconds (was 60)
}

init();
