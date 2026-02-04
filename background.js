// Background Service Worker for Natural Disaster Alerts
// Monitors multiple APIs by region: Earthquakes (global), Weather alerts (regional)

// ============================================
// API ENDPOINTS BY REGION
// ============================================
const APIS = {
  // GLOBAL - USGS Earthquakes, M2.5+ in last hour
  earthquakes: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson',
  
  // USA - NWS Alerts (has CORS)
  nwsAlerts: 'https://api.weather.gov/alerts/active',
  
  // NEW ZEALAND - GeoNet (has CORS) - Earthquakes
  geonetQuakes: 'https://api.geonet.org.nz/quake?MMI=3',
  
  // NEW ZEALAND - MetService CAP Feed - Severe Weather Alerts
  metserviceCap: 'https://alerts.metservice.com/cap/rss',
  
  // EUROPE - MeteoAlarm RSS feeds (entire Europe)
  meteoalarmEurope: 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-europe',
  
  // CANADA - NAAD (National Alert Aggregation & Dissemination)
  canadaNAAD: 'https://rss.naad-adna.pelmorex.com/',
  
  // ARGENTINA - SMN (Servicio Meteorológico Nacional)
  argentinaSMN: 'https://ssl.smn.gob.ar/CAP/AR.php',
  
  // BRAZIL - INMET
  brazilINMET: 'https://apiprevmet3.inmet.gov.br/avisos/rss',
  
  // CHILE - Meteochile
  chileMeteo: 'https://archivos.meteochile.gob.cl/portaldmc/rss/rss.php',
  
  // WMO Alert Hub - Global aggregator (backup for countries without direct feeds)
  wmoAlertHub: 'https://severeweather.wmo.int/json/sources.json',
  
  // NOAA NHC - Active tropical cyclones (Atlantic + Pacific)
  hurricanes: 'https://www.nhc.noaa.gov/CurrentStorms.json',
};

// ============================================
// REGION DETECTION
// ============================================

// Bounding boxes for regions [minLat, maxLat, minLon, maxLon]
const REGIONS = {
  USA: { bounds: [24, 50, -125, -66], name: 'USA' },
  USA_ALASKA: { bounds: [51, 72, -180, -130], name: 'Alaska' },
  USA_HAWAII: { bounds: [18, 23, -161, -154], name: 'Hawaii' },
  CANADA: { bounds: [41, 84, -141, -52], name: 'Canada' },
  NEW_ZEALAND: { bounds: [-48, -34, 166, 179], name: 'New Zealand' },
  AUSTRALIA: { bounds: [-45, -10, 112, 154], name: 'Australia' },
  EUROPE: { bounds: [35, 72, -25, 45], name: 'Europe' },
  JAPAN: { bounds: [24, 46, 122, 154], name: 'Japan' },
  ARGENTINA: { bounds: [-56, -21, -74, -53], name: 'Argentina' },
  BRAZIL: { bounds: [-34, 6, -74, -34], name: 'Brazil' },
  CHILE: { bounds: [-56, -17, -76, -66], name: 'Chile' },
  SOUTH_AMERICA: { bounds: [-56, 13, -82, -34], name: 'South America' },
};

// European countries for MeteoAlarm
const METEOALARM_COUNTRIES = {
  AT: 'austria', BE: 'belgium', BA: 'bosnia-herzegovina', BG: 'bulgaria',
  HR: 'croatia', CY: 'cyprus', CZ: 'czechia', DK: 'denmark', EE: 'estonia',
  FI: 'finland', FR: 'france', DE: 'germany', GR: 'greece', HU: 'hungary',
  IS: 'iceland', IE: 'ireland', IT: 'italy', LV: 'latvia', LT: 'lithuania',
  LU: 'luxembourg', MT: 'malta', MD: 'moldova', ME: 'montenegro', NL: 'netherlands',
  MK: 'north-macedonia', NO: 'norway', PL: 'poland', PT: 'portugal', RO: 'romania',
  RS: 'serbia', SK: 'slovakia', SI: 'slovenia', ES: 'spain', SE: 'sweden',
  CH: 'switzerland', GB: 'united-kingdom', UK: 'united-kingdom'
};

function getRegions(lat, lon) {
  const regions = [];
  for (const [key, region] of Object.entries(REGIONS)) {
    const [minLat, maxLat, minLon, maxLon] = region.bounds;
    if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) {
      regions.push(key);
    }
  }
  return regions;
}

function isInUSA(lat, lon) {
  const regions = getRegions(lat, lon);
  return regions.some(r => r.startsWith('USA'));
}

function isInNewZealand(lat, lon) {
  return getRegions(lat, lon).includes('NEW_ZEALAND');
}

function isInCanada(lat, lon) {
  return getRegions(lat, lon).includes('CANADA');
}

function isInEurope(lat, lon) {
  return getRegions(lat, lon).includes('EUROPE');
}

function isInAustralia(lat, lon) {
  return getRegions(lat, lon).includes('AUSTRALIA');
}

function isInArgentina(lat, lon) {
  return getRegions(lat, lon).includes('ARGENTINA');
}

function isInBrazil(lat, lon) {
  return getRegions(lat, lon).includes('BRAZIL');
}

function isInChile(lat, lon) {
  return getRegions(lat, lon).includes('CHILE');
}

function isInSouthAmerica(lat, lon) {
  return getRegions(lat, lon).includes('SOUTH_AMERICA');
}

const CHECK_INTERVAL_MINUTES = 3;
const STORAGE_KEY_SEEN = 'seenDisasters';
const STORAGE_KEY_ALERTS = 'activeAlerts';
const STORAGE_KEY_SETTINGS = 'weatherClockSettings';

// ============================================
// ALERT LEVEL MAPPING
// ============================================

// Disaster type configs
const DISASTER_TYPES = {
  earthquake: { emoji: '🌍', color: '#8B4513', name: 'Earthquake' },
  tsunami: { emoji: '🌊', color: '#1E90FF', name: 'Tsunami' },
  volcano: { emoji: '🌋', color: '#FF4500', name: 'Volcano' },
  hurricane: { emoji: '🌀', color: '#9400D3', name: 'Hurricane' },
  wildfire: { emoji: '🔥', color: '#FF6347', name: 'Wildfire' },
  tornado: { emoji: '🌪️', color: '#708090', name: 'Tornado' },
  severe_weather: { emoji: '⛈️', color: '#FFD700', name: 'Severe Weather' }
};

// ============================================
// INITIALIZATION
// ============================================
chrome.runtime.onInstalled.addListener(() => {
  console.log('Weather Clock: Setting up disaster monitoring...');
  setupAlarm();
  checkAllDisasters();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Weather Clock: Starting disaster monitoring...');
  setupAlarm();
  checkAllDisasters();
});

function setupAlarm() {
  chrome.alarms.create('checkDisasters', {
    delayInMinutes: 0.1,
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkDisasters') {
    checkAllDisasters();
  }
});

// ============================================
// UTILITY FUNCTIONS
// ============================================
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


function formatTimeAgo(minutes) {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function formatDistance(km) {
  if (km < 1) return '< 1 km';
  if (km < 100) return `${Math.round(km)} km`;
  return `${Math.round(km / 10) * 10} km`;
}

function getDirection(userLat, userLon, eventLat, eventLon) {
  const dLon = eventLon - userLon;
  const dLat = eventLat - userLat;
  const angle = Math.atan2(dLon, dLat) * 180 / Math.PI;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(((angle + 360) % 360) / 45) % 8;
  return directions[index];
}

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

// Map CAP weather severity directly to alert level.
// The issuing authority defines severity; time/distance should not inflate it.
//   Extreme → critical (red), Severe → high (orange),
//   Moderate → moderate (yellow), Minor/Unknown → info (hidden)
function mapWeatherSeverity(severity) {
  if (severity === 'Extreme') return { alertLevel: 'critical', relevance: 90 };
  if (severity === 'Severe') return { alertLevel: 'high', relevance: 60 };
  if (severity === 'Moderate') return { alertLevel: 'moderate', relevance: 30 };
  return { alertLevel: 'info', relevance: 10 };
}

// Map calculated local MMI (at user's location) to alert level.
// MMI 6+ Strong (damage possible), 5 Moderate (felt by all),
// 4 Light (felt by many), <4 Not felt / barely felt.
// M7+ earthquakes always show as moderate minimum (major events).
function mapLocalMMI(localMMI, magnitude) {
  if (localMMI >= 6) return { alertLevel: 'critical', relevance: 90 };
  if (localMMI >= 5) return { alertLevel: 'high', relevance: 60 };
  if (localMMI >= 4) return { alertLevel: 'moderate', relevance: 30 };
  if (magnitude >= 7) return { alertLevel: 'moderate', relevance: 25 };
  return { alertLevel: 'info', relevance: 5 };
}

// Elevate an alert level by one step (e.g., for tsunami/tornado warnings).
function elevateAlertLevel({ alertLevel, relevance }) {
  if (alertLevel === 'info') return { alertLevel: 'moderate', relevance: 30 };
  if (alertLevel === 'moderate') return { alertLevel: 'high', relevance: 60 };
  return { alertLevel: 'critical', relevance: 90 };
}

// Check if location is in hurricane-prone area
function isHurricaneZone(lat, lon) {
  // Atlantic hurricane zone (including Caribbean, Gulf)
  const atlantic = lat >= 8 && lat <= 45 && lon >= -100 && lon <= -15;
  // Eastern Pacific
  const eastPacific = lat >= 8 && lat <= 30 && lon >= -140 && lon <= -100;
  // Western Pacific (typhoons)
  const westPacific = lat >= 5 && lat <= 40 && lon >= 100 && lon <= 180;
  return atlantic || eastPacific || westPacific;
}

// ============================================
// GET ALL USER LOCATIONS
// ============================================
async function getUserLocations(settings) {
  const locations = [];
  
  // GPS location (always included if available)
  if (settings.cachedLat && settings.cachedLon) {
    locations.push({
      name: settings.locationName || 'Current Location',
      lat: settings.cachedLat,
      lon: settings.cachedLon,
      isGps: true,
      alertsEnabled: true
    });
  }
  
  // Saved cities (only if alertsEnabled)
  if (settings.savedCities && Array.isArray(settings.savedCities)) {
    settings.savedCities.forEach(city => {
      if (city.alertsEnabled !== false) { // Default true
        locations.push({
          name: city.name,
          lat: city.lat,
          lon: city.lon,
          isGps: false,
          alertsEnabled: true
        });
      }
    });
  }
  
  return locations;
}

// ============================================
// EARTHQUAKE CHECKING (USGS)
// ============================================
async function checkEarthquakes(locations, seenIds) {
  const alerts = [];
  
  try {
    const response = await fetch(APIS.earthquakes);
    if (!response.ok) return alerts;
    
    const data = await response.json();
    const earthquakes = data.features || [];
    
    for (const eq of earthquakes) {
      if (seenIds.includes(eq.id)) continue;
      seenIds.push(eq.id);
      
      const props = eq.properties;
      const [lon, lat, depth] = eq.geometry.coordinates;
      const magnitude = props.mag || 0;
      const sig = props.sig || 0;
      const tsunami = props.tsunami || 0;
      const time = props.time;
      
      // Check relevance for each location
      for (const location of locations) {
        const distanceKm = calculateDistance(location.lat, location.lon, lat, lon);
        const minutesAgo = (Date.now() - time) / 60000;

        // Calculate local MMI at user's location
        const hypocentralDist = Math.sqrt(distanceKm * distanceKm + (depth || 10) ** 2);
        let localMMI = hypocentralDist < 1 ?
          Math.min(12, 5.07 + 1.09 * magnitude) :
          5.07 + 1.09 * magnitude - 3.69 * Math.log10(hypocentralDist);
        localMMI = Math.max(1, Math.min(12, localMMI));

        let { alertLevel, relevance } = mapLocalMMI(localMMI, magnitude);
        if (tsunami === 1) ({ alertLevel, relevance } = elevateAlertLevel({ alertLevel, relevance }));

        if (alertLevel !== 'info') {
          alerts.push({
            id: eq.id,
            type: 'earthquake',
            alertLevel,
            magnitude,
            depth: depth || 0,
            localMMI: Math.round(localMMI * 10) / 10,
            distanceKm: Math.round(distanceKm),
            minutesAgo: Math.round(minutesAgo),
            relevance,
            place: props.place,
            time,
            tsunami: tsunami === 1,
            url: props.url,
            locationName: location.name,
            eventLat: lat,
            eventLon: lon
          });
          break; // Only one alert per earthquake (use highest relevance location)
        }
      }
    }
  } catch (err) {
    console.error('Weather Clock: Earthquake check error:', err);
  }
  
  return alerts;
}

// ============================================
// NWS ALERTS (Tsunamis, Severe Weather - USA)
// api.weather.gov has CORS enabled
// ============================================
async function checkNWSAlerts(locations, seenIds) {
  const alerts = [];
  
  // Only check if any location is in USA
  const usaLocations = locations.filter(loc => isInUSA(loc.lat, loc.lon));
  if (usaLocations.length === 0) return alerts;
  
  try {
    const response = await fetch(APIS.nwsAlerts, {
      headers: {
        'User-Agent': 'WeatherClockExtension/1.0 (github.com/weather-clock)',
        'Accept': 'application/geo+json'
      }
    });
    
    if (!response.ok) {
      console.log('Weather Clock: NWS API returned', response.status);
      return alerts;
    }
    
    const data = await response.json();
    const features = data.features || [];
    
    // Filter for high-priority events
    const priorityEvents = [
      'Tsunami Warning', 'Tsunami Watch', 'Tsunami Advisory',
      'Earthquake Warning', 'Volcano Warning',
      'Tornado Warning', 'Tornado Watch',
      'Hurricane Warning', 'Hurricane Watch',
      'Typhoon Warning', 'Typhoon Watch',
      'Tropical Storm Warning', 'Tropical Storm Watch',
      'Extreme Wind Warning', 'Storm Surge Warning',
      'Flash Flood Emergency', 'Flash Flood Warning'
    ];
    
    for (const feature of features) {
      const props = feature.properties;
      const eventType = props.event || '';
      
      // Skip if not a priority event
      if (!priorityEvents.some(pe => eventType.includes(pe.split(' ')[0]))) continue;
      
      const id = props.id || `nws-${props.event}-${props.onset}`;
      if (seenIds.includes(id)) continue;
      seenIds.push(id);
      
      // Get alert geometry center or use affected zones
      let alertLat = null, alertLon = null;
      
      if (feature.geometry && feature.geometry.type === 'Polygon') {
        // Calculate centroid of polygon
        const coords = feature.geometry.coordinates[0];
        const sumLat = coords.reduce((sum, c) => sum + c[1], 0);
        const sumLon = coords.reduce((sum, c) => sum + c[0], 0);
        alertLat = sumLat / coords.length;
        alertLon = sumLon / coords.length;
      }
      
      if (!alertLat || !alertLon) continue;
      
      const time = new Date(props.onset || props.effective || props.sent).getTime();
      const severity = props.severity; // Extreme, Severe, Moderate, Minor
      const certainty = props.certainty; // Observed, Likely, Possible
      
      // Determine alert type
      let type = 'severe_weather';
      if (eventType.toLowerCase().includes('tsunami')) type = 'tsunami';
      else if (eventType.toLowerCase().includes('tornado')) type = 'tornado';
      else if (eventType.toLowerCase().includes('hurricane') || eventType.toLowerCase().includes('typhoon')) type = 'hurricane';
      else if (eventType.toLowerCase().includes('volcano')) type = 'volcano';
      else if (eventType.toLowerCase().includes('earthquake')) type = 'earthquake';
      
      // Check relevance for USA locations
      for (const location of usaLocations) {
        const distanceKm = calculateDistance(location.lat, location.lon, alertLat, alertLon);
        const minutesAgo = (Date.now() - time) / 60000;

        let { alertLevel, relevance } = mapWeatherSeverity(severity);
        // Tsunami/tornado warnings elevate one step
        if (type === 'tsunami' || type === 'tornado') {
          ({ alertLevel, relevance } = elevateAlertLevel({ alertLevel, relevance }));
        }

        if (alertLevel !== 'info') {
          alerts.push({
            id,
            type,
            alertLevel,
            distanceKm: Math.round(distanceKm),
            minutesAgo: Math.round(minutesAgo),
            relevance,
            place: props.areaDesc || props.headline || eventType,
            headline: props.headline,
            severity,
            time,
            locationName: location.name,
            eventLat: alertLat,
            eventLon: alertLon,
            nwsEvent: eventType,
            url: `https://alerts.weather.gov`
          });
          break;
        }
      }
    }
  } catch (err) {
    console.error('Weather Clock: NWS alerts check error:', err);
  }
  
  return alerts;
}

// ============================================
// GEONET CHECKING (NEW ZEALAND)
// api.geonet.org.nz - Earthquakes and volcanic alerts
// ============================================
async function checkGeoNet(locations, seenIds) {
  const alerts = [];
  
  // Only check if any location is in New Zealand
  const nzLocations = locations.filter(loc => isInNewZealand(loc.lat, loc.lon));
  if (nzLocations.length === 0) return alerts;
  
  try {
    const response = await fetch(APIS.geonetQuakes);
    if (!response.ok) {
      console.log('Weather Clock: GeoNet API returned', response.status);
      return alerts;
    }
    
    const data = await response.json();
    const features = data.features || [];
    
    for (const feature of features) {
      const props = feature.properties;
      const id = props.publicID || `geonet-${props.time}`;
      
      if (seenIds.includes(id)) continue;
      seenIds.push(id);
      
      const coords = feature.geometry?.coordinates;
      if (!coords) continue;
      
      const [lon, lat, depth] = coords;
      const magnitude = props.magnitude;
      const mmi = props.mmi; // Modified Mercalli Intensity
      const time = new Date(props.time).getTime();
      
      for (const location of nzLocations) {
        const distanceKm = calculateDistance(location.lat, location.lon, lat, lon);
        const minutesAgo = (Date.now() - time) / 60000;

        // Calculate local MMI at user's location (not epicentral MMI)
        const hypocentralDist = Math.sqrt(distanceKm * distanceKm + (depth || 10) ** 2);
        let localMMI = hypocentralDist < 1 ?
          Math.min(12, 5.07 + 1.09 * magnitude) :
          5.07 + 1.09 * magnitude - 3.69 * Math.log10(hypocentralDist);
        localMMI = Math.max(1, Math.min(12, localMMI));

        const { alertLevel, relevance } = mapLocalMMI(localMMI, magnitude);

        if (alertLevel !== 'info') {
          alerts.push({
            id,
            type: 'earthquake',
            alertLevel,
            magnitude,
            depth: depth || 0,
            localMMI: Math.round(localMMI * 10) / 10,
            distanceKm: Math.round(distanceKm),
            minutesAgo: Math.round(minutesAgo),
            relevance,
            place: props.locality || `${Math.round(distanceKm)}km from ${location.name}`,
            time,
            locationName: location.name,
            eventLat: lat,
            eventLon: lon,
            source: 'GeoNet',
            url: `https://www.geonet.org.nz/earthquake/${id}`
          });
          break;
        }
      }
    }
  } catch (err) {
    console.error('Weather Clock: GeoNet check error:', err);
  }
  
  return alerts;
}

// ============================================
// METSERVICE CAP CHECKING (NEW ZEALAND WEATHER)
// https://alerts.metservice.com/cap/rss - Severe Weather Alerts
// ============================================
async function checkMetServiceCAP(locations, seenIds) {
  const alerts = [];
  
  // Only check if any location is in New Zealand
  const nzLocations = locations.filter(loc => isInNewZealand(loc.lat, loc.lon));
  if (nzLocations.length === 0) return alerts;
  
  try {
    const response = await fetch(APIS.metserviceCap, {
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });
    if (!response.ok) {
      console.log('Weather Clock: MetService CAP returned', response.status);
      return alerts;
    }
    
    const text = await response.text();
    
    // Parse RSS XML using regex (DOMParser not available in service workers)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items = [...text.matchAll(itemRegex)];
    
    for (const itemMatch of items) {
      const itemXml = itemMatch[1];
      
      // Extract fields
      const getTag = (tag) => {
        const match = itemXml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
        return match ? match[1].trim() : null;
      };
      
      const guid = getTag('guid');
      const title = getTag('title');
      const description = getTag('description');
      const link = getTag('link');
      const pubDate = getTag('pubDate');
      
      if (!guid || seenIds.includes(guid)) continue;
      seenIds.push(guid);
      
      // Determine alert type and severity from headline
      let type = 'severe_weather';
      let severity = 'Moderate';
      let eventType = 'weather';
      
      if (title) {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('rain')) eventType = 'rain';
        else if (lowerTitle.includes('snow')) eventType = 'snow';
        else if (lowerTitle.includes('wind')) eventType = 'wind';
        else if (lowerTitle.includes('thunderstorm')) eventType = 'thunderstorm';
        
        if (lowerTitle.includes('red') || lowerTitle.includes('severe thunderstorm warning')) {
          severity = 'Severe';
        } else if (lowerTitle.includes('orange') || lowerTitle.includes('warning')) {
          severity = 'Moderate';
        } else if (lowerTitle.includes('watch')) {
          severity = 'Minor';
        }
      }
      
      const time = pubDate ? new Date(pubDate).getTime() : Date.now();
      const minutesAgo = (Date.now() - time) / 60000;
      
      // For CAP alerts, we apply to all NZ locations since polygon parsing is complex
      // The alert is relevant if user is anywhere in NZ
      for (const location of nzLocations) {
        let { alertLevel, relevance } = mapWeatherSeverity(severity);
        // Severe thunderstorm warnings elevate one step
        if (eventType === 'thunderstorm' && severity === 'Severe') {
          ({ alertLevel, relevance } = elevateAlertLevel({ alertLevel, relevance }));
        }

        if (alertLevel !== 'info') {
          alerts.push({
            id: guid,
            type: 'severe_weather',
            alertLevel,
            severity,
            eventType,
            minutesAgo: Math.round(minutesAgo),
            relevance,
            place: title || 'New Zealand',
            headline: title,
            description: description,
            time,
            locationName: location.name,
            source: 'MetService',
            url: link
          });
          break; // Only one alert per CAP item
        }
      }
    }
  } catch (err) {
    console.error('Weather Clock: MetService CAP check error:', err);
  }
  
  return alerts;
}

// ============================================
// ARGENTINA SMN CAP CHECKING
// https://ssl.smn.gob.ar/CAP/AR.php - Servicio Meteorológico Nacional
// Fetches RSS feed, then individual CAP XMLs for polygon intersection
// ============================================

// Point-in-polygon algorithm (ray casting)
function pointInPolygon(lat, lon, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    
    if (((yi > lat) !== (yj > lat)) && 
        (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Parse SMN polygon string "lat,lon lat,lon ..." into array [[lat,lon], ...]
function parseSMNPolygon(polygonStr) {
  if (!polygonStr) return null;
  const points = polygonStr.trim().split(/\s+/);
  const coords = [];
  for (const point of points) {
    const [lat, lon] = point.split(',').map(Number);
    if (!isNaN(lat) && !isNaN(lon)) {
      coords.push([lat, lon]);
    }
  }
  return coords.length >= 3 ? coords : null;
}

// Fetch individual CAP XML and check if location is within polygon
async function fetchSMNAlertDetail(alertUrl, location) {
  try {
    // Rewrite http:// to https:// to avoid CORS-blocked redirects
    const url = alertUrl.replace(/^http:\/\//, 'https://');

    const response = await fetch(url, {
      headers: { 'Accept': 'application/xml, text/xml' }
    });
    if (!response.ok) return null;

    const text = await response.text();

    // Parse polygon
    const polygonMatch = text.match(/<polygon>([^<]+)<\/polygon>/);
    if (!polygonMatch) {
      return null;
    }

    const polygon = parseSMNPolygon(polygonMatch[1]);
    if (!polygon) {
      return null;
    }

    // Check if user location is inside polygon
    const isInside = pointInPolygon(location.lat, location.lon, polygon);

    if (!isInside) {
      return null; // User not in affected area
    }

    // Match found - details logged in summary at end of checkArgentinaSMN
    
    // Parse other fields
    const getTag = (tag) => {
      const match = text.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
      return match ? match[1].trim() : null;
    };
    
    const getTagContent = (tag) => {
      const match = text.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return match ? match[1].trim() : null;
    };
    
    return {
      event: getTag('event'),
      headline: getTag('headline'),
      description: getTagContent('description'),
      severity: getTag('severity'),
      urgency: getTag('urgency'),
      certainty: getTag('certainty'),
      onset: getTag('onset'),
      expires: getTag('expires'),
      sent: getTag('sent'),
      polygon
    };
  } catch (err) {
    console.error('Weather Clock: Error fetching SMN alert detail:', err);
    return null;
  }
}

async function checkArgentinaSMN(locations, seenIds) {
  const alerts = [];
  
  const arLocations = locations.filter(loc => isInArgentina(loc.lat, loc.lon));
  if (arLocations.length === 0) return alerts;
  
  try {
    // 1. Fetch RSS feed
    const response = await fetch(APIS.argentinaSMN, {
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' }
    });
    if (!response.ok) {
      console.log('Weather Clock: Argentina SMN returned', response.status);
      return alerts;
    }
    
    const text = await response.text();
    
    // 2. Extract all alert links from RSS
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items = [...text.matchAll(itemRegex)];
    
    // Track which alert types we've already added per location (deduplication)
    const seenAlertTypes = new Map(); // locationName -> Set of alertTypeKeys
    
    // Limit concurrent fetches to avoid overwhelming the server
    const MAX_CONCURRENT = 5;
    const alertLinks = [];
    
    for (const itemMatch of items) {
      const itemXml = itemMatch[1];
      const linkMatch = itemXml.match(/<link>([^<]+)<\/link>/);
      const guidMatch = itemXml.match(/<guid>([^<]+)<\/guid>/);
      const titleMatch = itemXml.match(/<title>([^<]+)<\/title>/);
      const descMatch = itemXml.match(/<description>([^<]+)<\/description>/);
      
      const link = linkMatch ? linkMatch[1].trim() : null;
      const guid = guidMatch ? guidMatch[1].trim() : null;
      const title = titleMatch ? titleMatch[1].trim() : '';
      const description = descMatch ? descMatch[1].trim() : '';
      
      if (!link || !link.includes('.xml')) continue;
      
      // Skip already seen
      const id = guid || link;
      if (seenIds.includes(id)) continue;
      
      alertLinks.push({ link, id, title, description });
    }
    
    console.log(`Weather Clock: SMN found ${alertLinks.length} alert XMLs to check`);
    
    // 3. Fetch individual CAP XMLs in batches and check polygon intersection
    for (let i = 0; i < alertLinks.length; i += MAX_CONCURRENT) {
      const batch = alertLinks.slice(i, i + MAX_CONCURRENT);
      
      const batchPromises = batch.flatMap(({ link, id, title, description }) => 
        arLocations.map(async (location) => {
          const detail = await fetchSMNAlertDetail(link, location);
          if (!detail) return null; // Location not in polygon or fetch failed
          
          // Create alert type key for deduplication
          const eventType = (detail.event || title || '').toLowerCase();
          const severity = detail.severity || 'Moderate';
          
          let phenomenon = 'clima';
          if (eventType.includes('tormenta') || eventType.includes('granizo')) phenomenon = 'tormenta';
          else if (eventType.includes('viento')) phenomenon = 'viento';
          else if (eventType.includes('lluvia')) phenomenon = 'lluvia';
          else if (eventType.includes('nieve')) phenomenon = 'nieve';
          else if (eventType.includes('calor') || eventType.includes('temperatura')) phenomenon = 'calor';
          else if (eventType.includes('frio') || eventType.includes('helada')) phenomenon = 'frio';
          
          const alertTypeKey = `${phenomenon}-${severity}`;
          
          // Check for duplicates per location
          if (!seenAlertTypes.has(location.name)) {
            seenAlertTypes.set(location.name, new Set());
          }
          if (seenAlertTypes.get(location.name).has(alertTypeKey)) {
            return null; // Already have this type of alert for this location
          }
          seenAlertTypes.get(location.name).add(alertTypeKey);
          
          // Mark as seen
          seenIds.push(id);
          
          // Calculate time and relevance
          const time = detail.onset ? new Date(detail.onset).getTime() : 
                       detail.sent ? new Date(detail.sent).getTime() : Date.now();
          const minutesAgo = (Date.now() - time) / 60000;
          
          const { alertLevel, relevance } = mapWeatherSeverity(severity);
          if (alertLevel === 'info') return null;
          
          return {
            id: `smn-${alertTypeKey}-${location.name}`,
            type: 'severe_weather',
            alertLevel,
            severity,
            eventType: phenomenon,
            minutesAgo: Math.round(minutesAgo),
            relevance: Math.round(relevance * 10) / 10,
            place: detail.event || title,
            headline: detail.headline || title,
            description: detail.description || description,
            time,
            locationName: location.name,
            source: 'SMN Argentina',
            expires: detail.expires ? new Date(detail.expires).getTime() : null,
            url: 'https://www.smn.gob.ar/alertas'
          };
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      alerts.push(...batchResults.filter(a => a !== null));
    }
    
    if (alerts.length > 0) {
      console.log(`Weather Clock: SMN ${alerts.length}/${alertLinks.length} alerts match user locations:`,
        alerts.map(a => `${a.severity} ${a.eventType} for ${a.locationName}`));
    }
    
  } catch (err) {
    console.error('Weather Clock: Argentina SMN check error:', err);
  }
  
  return alerts;
}

// ============================================
// EUROPE METEOALARM CAP CHECKING
// https://feeds.meteoalarm.org/ - 38 European countries
// ============================================
async function checkMeteoAlarm(locations, seenIds) {
  const alerts = [];
  
  const euLocations = locations.filter(loc => isInEurope(loc.lat, loc.lon));
  if (euLocations.length === 0) return alerts;
  
  try {
    const response = await fetch(APIS.meteoalarmEurope, {
      headers: { 'Accept': 'application/atom+xml, application/xml, text/xml' }
    });
    if (!response.ok) {
      console.log('Weather Clock: MeteoAlarm returned', response.status);
      return alerts;
    }
    
    const text = await response.text();
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    const items = [...text.matchAll(entryRegex)];
    
    for (const itemMatch of items) {
      const itemXml = itemMatch[1];
      
      const getTag = (tag) => {
        const match = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return match ? match[1].trim() : null;
      };
      
      const id = getTag('id');
      const title = getTag('title');
      const summary = getTag('summary');
      const updated = getTag('updated');
      
      if (!id || seenIds.includes(id)) continue;
      seenIds.push(id);
      
      // Parse severity from title or content
      let severity = 'Moderate';
      let eventType = 'weather';
      
      if (title || summary) {
        const content = (title + ' ' + (summary || '')).toLowerCase();
        if (content.includes('red') || content.includes('extreme')) severity = 'Severe';
        else if (content.includes('orange') || content.includes('severe')) severity = 'Moderate';
        else if (content.includes('yellow') || content.includes('moderate')) severity = 'Minor';
        
        if (content.includes('wind') || content.includes('viento')) eventType = 'wind';
        else if (content.includes('rain') || content.includes('lluvia')) eventType = 'rain';
        else if (content.includes('snow') || content.includes('nieve')) eventType = 'snow';
        else if (content.includes('thunder') || content.includes('storm')) eventType = 'thunderstorm';
        else if (content.includes('heat') || content.includes('calor')) eventType = 'heat';
        else if (content.includes('cold') || content.includes('frost')) eventType = 'cold';
        else if (content.includes('flood')) eventType = 'flood';
        else if (content.includes('fog')) eventType = 'fog';
      }
      
      const time = updated ? new Date(updated).getTime() : Date.now();
      const minutesAgo = (Date.now() - time) / 60000;
      
      for (const location of euLocations) {
        const { alertLevel, relevance } = mapWeatherSeverity(severity);

        if (alertLevel !== 'info') {
          alerts.push({
            id,
            type: 'severe_weather',
            alertLevel,
            severity,
            eventType,
            minutesAgo: Math.round(minutesAgo),
            relevance,
            place: title || 'Europe',
            headline: title,
            description: summary,
            time,
            locationName: location.name,
            source: 'MeteoAlarm',
            url: 'https://www.meteoalarm.org'
          });
          break;
        }
      }
    }
  } catch (err) {
    console.error('Weather Clock: MeteoAlarm check error:', err);
  }
  
  return alerts;
}

// ============================================
// BRAZIL INMET CAP CHECKING
// https://apiprevmet3.inmet.gov.br/avisos/rss
// ============================================
async function checkBrazilINMET(locations, seenIds) {
  const alerts = [];
  
  const brLocations = locations.filter(loc => isInBrazil(loc.lat, loc.lon));
  if (brLocations.length === 0) return alerts;
  
  try {
    const response = await fetch(APIS.brazilINMET, {
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' }
    });
    if (!response.ok) {
      console.log('Weather Clock: Brazil INMET returned', response.status);
      return alerts;
    }
    
    const text = await response.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items = [...text.matchAll(itemRegex)];
    
    for (const itemMatch of items) {
      const itemXml = itemMatch[1];
      
      const getTag = (tag) => {
        const match = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return match ? match[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '') : null;
      };
      
      const guid = getTag('guid');
      const title = getTag('title');
      const description = getTag('description');
      const pubDate = getTag('pubDate');
      
      if (!guid || seenIds.includes(guid)) continue;
      seenIds.push(guid);
      
      let severity = 'Moderate';
      let eventType = 'weather';
      
      if (title) {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('vermelho') || lowerTitle.includes('perigo')) severity = 'Severe';
        else if (lowerTitle.includes('laranja')) severity = 'Moderate';
        else if (lowerTitle.includes('amarelo')) severity = 'Minor';
        
        if (lowerTitle.includes('chuva') || lowerTitle.includes('precipitação')) eventType = 'rain';
        else if (lowerTitle.includes('tempestade')) eventType = 'thunderstorm';
        else if (lowerTitle.includes('vento')) eventType = 'wind';
        else if (lowerTitle.includes('onda de calor')) eventType = 'heat';
      }
      
      const time = pubDate ? new Date(pubDate).getTime() : Date.now();
      const minutesAgo = (Date.now() - time) / 60000;
      
      for (const location of brLocations) {
        const { alertLevel, relevance } = mapWeatherSeverity(severity);

        if (alertLevel !== 'info') {
          alerts.push({
            id: guid,
            type: 'severe_weather',
            alertLevel,
            severity,
            eventType,
            minutesAgo: Math.round(minutesAgo),
            relevance,
            place: title || 'Brasil',
            headline: title,
            description,
            time,
            locationName: location.name,
            source: 'INMET Brasil',
            url: 'https://alertas2.inmet.gov.br'
          });
          break;
        }
      }
    }
  } catch (err) {
    console.error('Weather Clock: Brazil INMET check error:', err);
  }
  
  return alerts;
}

// ============================================
// CHILE METEOCHILE CAP CHECKING
// https://archivos.meteochile.gob.cl/portaldmc/rss/rss.php
// ============================================
async function checkChileMeteo(locations, seenIds) {
  const alerts = [];
  
  const clLocations = locations.filter(loc => isInChile(loc.lat, loc.lon));
  if (clLocations.length === 0) return alerts;
  
  try {
    const response = await fetch(APIS.chileMeteo, {
      headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' }
    });
    if (!response.ok) {
      console.log('Weather Clock: Chile Meteo returned', response.status);
      return alerts;
    }
    
    const text = await response.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const items = [...text.matchAll(itemRegex)];
    
    for (const itemMatch of items) {
      const itemXml = itemMatch[1];
      
      const getTag = (tag) => {
        const match = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return match ? match[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '') : null;
      };
      
      const guid = getTag('guid') || getTag('link');
      const title = getTag('title');
      const description = getTag('description');
      const pubDate = getTag('pubDate');
      
      if (!guid || seenIds.includes(guid)) continue;
      seenIds.push(guid);
      
      let severity = 'Moderate';
      let eventType = 'weather';
      
      if (title) {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('roja') || lowerTitle.includes('extrema')) severity = 'Severe';
        else if (lowerTitle.includes('naranja') || lowerTitle.includes('alerta')) severity = 'Moderate';
        else if (lowerTitle.includes('amarilla') || lowerTitle.includes('aviso')) severity = 'Minor';
        
        if (lowerTitle.includes('lluvia') || lowerTitle.includes('precipitaciones')) eventType = 'rain';
        else if (lowerTitle.includes('viento')) eventType = 'wind';
        else if (lowerTitle.includes('nieve')) eventType = 'snow';
        else if (lowerTitle.includes('tormenta')) eventType = 'thunderstorm';
        else if (lowerTitle.includes('marejada')) eventType = 'coastal';
        else if (lowerTitle.includes('frío')) eventType = 'cold';
      }
      
      const time = pubDate ? new Date(pubDate).getTime() : Date.now();
      const minutesAgo = (Date.now() - time) / 60000;
      
      for (const location of clLocations) {
        const { alertLevel, relevance } = mapWeatherSeverity(severity);

        if (alertLevel !== 'info') {
          alerts.push({
            id: guid,
            type: 'severe_weather',
            alertLevel,
            severity,
            eventType,
            minutesAgo: Math.round(minutesAgo),
            relevance,
            place: title || 'Chile',
            headline: title,
            description,
            time,
            locationName: location.name,
            source: 'MeteoChile',
            url: 'https://www.meteochile.gob.cl/alertas'
          });
          break;
        }
      }
    }
  } catch (err) {
    console.error('Weather Clock: Chile Meteo check error:', err);
  }
  
  return alerts;
}

// ============================================
// CANADA NAAD CAP CHECKING
// https://rss.naad-adna.pelmorex.com/
// ============================================
async function checkCanadaNAAD(locations, seenIds) {
  const alerts = [];
  
  const caLocations = locations.filter(loc => isInCanada(loc.lat, loc.lon));
  if (caLocations.length === 0) return alerts;
  
  try {
    const response = await fetch(APIS.canadaNAAD, {
      headers: { 'Accept': 'application/atom+xml, application/xml, text/xml' }
    });
    if (!response.ok) {
      console.log('Weather Clock: Canada NAAD returned', response.status);
      return alerts;
    }
    
    const text = await response.text();
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    const items = [...text.matchAll(entryRegex)];
    
    for (const itemMatch of items) {
      const itemXml = itemMatch[1];
      
      const getTag = (tag) => {
        const match = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return match ? match[1].trim() : null;
      };
      
      const id = getTag('id');
      const title = getTag('title');
      const summary = getTag('summary');
      const updated = getTag('updated');
      
      if (!id || seenIds.includes(id)) continue;
      seenIds.push(id);
      
      let severity = 'Moderate';
      let eventType = 'weather';
      
      if (title || summary) {
        const content = (title + ' ' + (summary || '')).toLowerCase();
        if (content.includes('warning') || content.includes('avertissement')) severity = 'Severe';
        else if (content.includes('watch') || content.includes('veille')) severity = 'Moderate';
        else if (content.includes('advisory') || content.includes('bulletin')) severity = 'Minor';
        
        if (content.includes('tornado') || content.includes('tornade')) eventType = 'tornado';
        else if (content.includes('thunderstorm') || content.includes('orage')) eventType = 'thunderstorm';
        else if (content.includes('wind') || content.includes('vent')) eventType = 'wind';
        else if (content.includes('rain') || content.includes('pluie')) eventType = 'rain';
        else if (content.includes('snow') || content.includes('neige')) eventType = 'snow';
        else if (content.includes('blizzard')) eventType = 'blizzard';
        else if (content.includes('frost') || content.includes('gel')) eventType = 'frost';
        else if (content.includes('heat') || content.includes('chaleur')) eventType = 'heat';
        else if (content.includes('flood') || content.includes('inondation')) eventType = 'flood';
      }
      
      const time = updated ? new Date(updated).getTime() : Date.now();
      const minutesAgo = (Date.now() - time) / 60000;
      
      for (const location of caLocations) {
        let { alertLevel, relevance } = mapWeatherSeverity(severity);
        // Tornado warnings elevate one step
        if (eventType === 'tornado') {
          ({ alertLevel, relevance } = elevateAlertLevel({ alertLevel, relevance }));
        }

        if (alertLevel !== 'info') {
          alerts.push({
            id,
            type: eventType === 'tornado' ? 'tornado' : 'severe_weather',
            alertLevel,
            severity,
            eventType,
            minutesAgo: Math.round(minutesAgo),
            relevance,
            place: title || 'Canada',
            headline: title,
            description: summary,
            time,
            locationName: location.name,
            source: 'NAAD Canada',
            url: 'https://weather.gc.ca/warnings/index_e.html'
          });
          break;
        }
      }
    }
  } catch (err) {
    console.error('Weather Clock: Canada NAAD check error:', err);
  }
  
  return alerts;
}

// ============================================
// HURRICANE CHECKING (NOAA NHC)
// ============================================
async function checkHurricanes(locations, seenIds) {
  const alerts = [];
  
  // Only check if any location is in hurricane zone
  const hasHurricaneZone = locations.some(loc => isHurricaneZone(loc.lat, loc.lon));
  if (!hasHurricaneZone) return alerts;
  
  try {
    const response = await fetch(APIS.hurricanesAtlantic);
    if (!response.ok) return alerts;
    
    const data = await response.json();
    const storms = data.activeStorms || [];
    
    for (const storm of storms) {
      const id = `hurricane-${storm.binNumber || storm.name}`;
      if (seenIds.includes(id)) continue;
      seenIds.push(id);
      
      const lat = storm.latitudeNumeric;
      const lon = storm.longitudeNumeric;
      const name = storm.name;
      const category = storm.classification; // e.g., "HU" for hurricane
      const intensity = storm.intensity || 0;
      
      for (const location of locations) {
        if (!isHurricaneZone(location.lat, location.lon)) continue;
        
        const distanceKm = calculateDistance(location.lat, location.lon, lat, lon);
        
        // Map hurricane alert level by classification + distance.
        // NHC classifications: HU=Hurricane, TS=Tropical Storm, TD=Depression
        if (distanceKm < 1500) {
          const isHurricane = category === 'HU';
          const isTropicalStorm = category === 'TS' || category === 'STS';

          let alertLevel, relevance;
          if (isHurricane && distanceKm < 500) { alertLevel = 'critical'; relevance = 90; }
          else if (isHurricane && distanceKm < 1000) { alertLevel = 'high'; relevance = 60; }
          else if (isTropicalStorm && distanceKm < 500) { alertLevel = 'high'; relevance = 60; }
          else if (isHurricane) { alertLevel = 'moderate'; relevance = 30; }
          else if (isTropicalStorm && distanceKm < 1000) { alertLevel = 'moderate'; relevance = 30; }
          else { alertLevel = 'info'; relevance = 5; }

          if (alertLevel !== 'info') {
            alerts.push({
              id,
              type: 'hurricane',
              alertLevel,
              name,
              category,
              intensity,
              distanceKm: Math.round(distanceKm),
              relevance,
              place: `${name} - ${storm.movementDir || ''} at ${storm.movementSpeed || '?'} mph`,
              time: Date.now(),
              locationName: location.name,
              eventLat: lat,
              eventLon: lon,
              url: 'https://www.nhc.noaa.gov'
            });
            break;
          }
        }
      }
    }
  } catch (err) {
    console.error('Weather Clock: Hurricane check error:', err);
  }
  
  return alerts;
}

// ============================================
// VOLCANO CHECKING
// Covered by NWS alerts for USA
// No free global API with CORS available
// ============================================
async function checkVolcanoes(locations, seenIds) {
  return [];
}

// ============================================
// MAIN CHECK FUNCTION
// ============================================
async function checkAllDisasters() {
  try {
    const storage = await chrome.storage.local.get([
      STORAGE_KEY_SETTINGS,
      STORAGE_KEY_SEEN,
      STORAGE_KEY_ALERTS
    ]);
    
    const settings = storage[STORAGE_KEY_SETTINGS] || {};
    let seenIds = storage[STORAGE_KEY_SEEN] || [];
    let activeAlerts = storage[STORAGE_KEY_ALERTS] || [];
    
    if (settings.alertsEnabled === false) {
      await updateBadge([]);
      return;
    }
    
    const locations = await getUserLocations(settings);
    if (locations.length === 0) {
      console.log('Weather Clock: No locations configured, skipping disaster check');
      return;
    }
    
    console.log(`Weather Clock: Checking disasters for ${locations.length} locations...`);
    
    // Determine which regional APIs to check based on locations
    const hasUSA = locations.some(loc => isInUSA(loc.lat, loc.lon));
    const hasNZ = locations.some(loc => isInNewZealand(loc.lat, loc.lon));
    const hasCanada = locations.some(loc => isInCanada(loc.lat, loc.lon));
    const hasEurope = locations.some(loc => isInEurope(loc.lat, loc.lon));
    const hasArgentina = locations.some(loc => isInArgentina(loc.lat, loc.lon));
    const hasBrazil = locations.some(loc => isInBrazil(loc.lat, loc.lon));
    const hasChile = locations.some(loc => isInChile(loc.lat, loc.lon));
    const hasHurricaneZone = locations.some(loc => isHurricaneZone(loc.lat, loc.lon));
    
    // Build list of checks to run
    const checks = [
      checkEarthquakes(locations, seenIds) // Always check global earthquakes
    ];
    
    // Regional weather alert APIs
    if (hasUSA) checks.push(checkNWSAlerts(locations, seenIds));
    if (hasNZ) {
      checks.push(checkGeoNet(locations, seenIds));      // NZ earthquakes
      checks.push(checkMetServiceCAP(locations, seenIds)); // NZ weather alerts
    }
    if (hasCanada) checks.push(checkCanadaNAAD(locations, seenIds));
    if (hasEurope) checks.push(checkMeteoAlarm(locations, seenIds));
    if (hasArgentina) checks.push(checkArgentinaSMN(locations, seenIds));
    if (hasBrazil) checks.push(checkBrazilINMET(locations, seenIds));
    if (hasChile) checks.push(checkChileMeteo(locations, seenIds));
    if (hasHurricaneZone) checks.push(checkHurricanes(locations, seenIds));
    
    // Log which APIs are being checked
    const regions = [];
    if (hasUSA) regions.push('USA');
    if (hasNZ) regions.push('NZ');
    if (hasCanada) regions.push('Canada');
    if (hasEurope) regions.push('Europe');
    if (hasArgentina) regions.push('Argentina');
    if (hasBrazil) regions.push('Brazil');
    if (hasChile) regions.push('Chile');
    if (hasHurricaneZone) regions.push('Hurricane');
    
    console.log(`Weather Clock: Running ${checks.length} API checks for regions: ${regions.join(', ') || 'Global only'}`);
    
    // Run all applicable checks in parallel
    const results = await Promise.all(checks);
    const newAlerts = results.flat();
    
    // Send notifications for new alerts
    for (const alert of newAlerts) {
      await sendNotification(alert);
    }
    
    // Clean up old data
    seenIds = seenIds.slice(-1000);
    const now = Date.now();
    const sixHoursAgo = now - 6 * 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    // Combine old and new alerts, removing duplicates by ID
    // Filter by age: 6h for weather alerts, 24h for earthquakes
    const combinedAlerts = [
      ...activeAlerts.filter(a => {
        if (a.type === 'earthquake') return a.time > oneDayAgo;
        return a.time > sixHoursAgo;
      }),
      ...newAlerts
    ];
    
    // Remove duplicates - keep the most recent version of each alert
    const alertMap = new Map();
    for (const alert of combinedAlerts) {
      const existing = alertMap.get(alert.id);
      if (!existing || alert.time > existing.time) {
        alertMap.set(alert.id, alert);
      }
    }
    activeAlerts = Array.from(alertMap.values()).slice(-100);
    
    await chrome.storage.local.set({
      [STORAGE_KEY_SEEN]: seenIds,
      [STORAGE_KEY_ALERTS]: activeAlerts
    });
    
    // Update badge - only show recent alerts (3h)
    const recentAlerts = activeAlerts.filter(a =>
      Date.now() - a.time < 3 * 60 * 60 * 1000
    );
    await updateBadge(recentAlerts);
    
    if (newAlerts.length > 0) {
      console.log(`Weather Clock: ${newAlerts.length} new alerts generated`);
    }
    
  } catch (err) {
    console.error('Weather Clock: Error checking disasters:', err);
  }
}

// ============================================
// NOTIFICATIONS
// ============================================
const STORAGE_KEY_NOTIFIED = 'notifiedAlerts';

async function sendNotification(alert) {
  // Check if we already sent a notification for this alert
  const storage = await chrome.storage.local.get(STORAGE_KEY_NOTIFIED);
  const notifiedIds = storage[STORAGE_KEY_NOTIFIED] || [];
  
  // Create a stable notification key (not just the ID, but type+time based)
  const notifKey = `${alert.type}-${alert.id}-${alert.locationName}`;
  
  if (notifiedIds.includes(notifKey)) {
    return; // Already notified for this alert
  }
  
  const typeInfo = DISASTER_TYPES[alert.type] || DISASTER_TYPES.earthquake;
  
  const levelEmoji = {
    critical: '🔴',
    high: '🟠',
    moderate: '🟡',
    info: 'ℹ️'
  };
  
  let title = `${levelEmoji[alert.alertLevel]} ${typeInfo.emoji} `;
  
  if (alert.type === 'earthquake') {
    title += `M${alert.magnitude.toFixed(1)} Earthquake`;
  } else if (alert.type === 'hurricane') {
    title += `${alert.name || 'Hurricane'}`;
  } else if (alert.type === 'severe_weather') {
    title += `${alert.severity || ''} Weather Alert`;
  } else {
    title += typeInfo.name;
  }
  
  let message = '';
  
  if (alert.distanceKm !== undefined) {
    message = `${formatDistance(alert.distanceKm)} from ${alert.locationName}`;
  } else {
    message = `${alert.locationName || ''}`;
  }
  
  if (alert.minutesAgo !== undefined && alert.minutesAgo < 120) {
    message += ` • ${formatTimeAgo(alert.minutesAgo)}`;
  }
  
  if (alert.place || alert.headline) {
    message += `\n📍 ${alert.headline || alert.place}`;
  }
  
  if (alert.type === 'earthquake' && alert.localMMI >= 3) {
    message += `\n💢 Expected: ${getMmiDescription(alert.localMMI)}`;
  }
  
  if (alert.tsunami) {
    message += '\n⚠️ TSUNAMI WARNING';
  }
  
  try {
    await chrome.notifications.create(notifKey, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
      priority: alert.alertLevel === 'critical' ? 2 : (alert.alertLevel === 'high' ? 1 : 0),
      requireInteraction: alert.alertLevel === 'critical' || alert.alertLevel === 'high'
    });
    
    // Save that we notified for this alert (keep last 500)
    notifiedIds.push(notifKey);
    const trimmedIds = notifiedIds.slice(-500);
    await chrome.storage.local.set({ [STORAGE_KEY_NOTIFIED]: trimmedIds });
    
  } catch (err) {
    console.error('Weather Clock: Failed to send notification:', err);
  }
}

// ============================================
// BADGE
// ============================================
async function updateBadge(alerts) {
  if (!alerts || alerts.length === 0) {
    await chrome.action.setBadgeText({ text: '' });
    return;
  }
  
  const hasLevel = (level) => alerts.some(a => a.alertLevel === level);
  
  if (hasLevel('critical')) {
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
  } else if (hasLevel('high')) {
    await chrome.action.setBadgeText({ text: '!' });
    await chrome.action.setBadgeBackgroundColor({ color: '#F97316' });
  } else if (hasLevel('moderate')) {
    await chrome.action.setBadgeText({ text: String(alerts.length) });
    await chrome.action.setBadgeBackgroundColor({ color: '#EAB308' });
  } else {
    await chrome.action.setBadgeText({ text: String(alerts.length) });
    await chrome.action.setBadgeBackgroundColor({ color: '#6B7280' });
  }
}

// ============================================
// MESSAGE HANDLING
// ============================================
chrome.notifications.onClicked.addListener((notificationId) => {
  // Try to open relevant URL based on notification ID
  if (notificationId.startsWith('us') || notificationId.startsWith('nc') || notificationId.startsWith('ak')) {
    // USGS earthquake ID
    chrome.tabs.create({
      url: `https://earthquake.usgs.gov/earthquakes/eventpage/${notificationId}`
    });
  }
  chrome.notifications.clear(notificationId);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAlerts') {
    chrome.storage.local.get(STORAGE_KEY_ALERTS).then(result => {
      sendResponse({ alerts: result[STORAGE_KEY_ALERTS] || [] });
    });
    return true;
  }
  
  if (request.action === 'checkNow') {
    checkAllDisasters().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === 'clearAlerts') {
    chrome.storage.local.set({ [STORAGE_KEY_ALERTS]: [] }).then(() => {
      updateBadge([]);
      sendResponse({ success: true });
    });
    return true;
  }
});

console.log('Weather Clock: Background service worker loaded - monitoring all disasters');
