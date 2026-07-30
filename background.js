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
  // Per-country Atom feeds; the aggregated Europe feed was retired upstream
  meteoalarmFeedBase: 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-',
  
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

// Time until an alert that has not started yet takes effect
function formatLeadTime(minutes) {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
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

// ============================================
// ALERT VALIDITY WINDOW
// ============================================
// Every CAP alert carries a validity window (onset/effective .. expires).
// An alert only reflects what the issuing authority shows on its own map while
// that window is open: an alert that already expired, or one whose onset is
// days away, is not "happening now". We keep alerts in effect right now plus
// those starting within UPCOMING_LEAD_MS so the user still gets advance
// notice - those are flagged isUpcoming so the UI can label them as such
// instead of implying they are active.
const UPCOMING_LEAD_MS = 24 * 60 * 60 * 1000;

// Parse a CAP timestamp into epoch ms, or null when absent/unparseable.
function parseCapTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return isNaN(time) ? null : time;
}

// Resolve an alert's validity window into the timing fields an alert carries.
// Returns null when the alert must be dropped (window closed, or onset too
// far out to be actionable).
function getAlertWindow({ onset, effective, expires, sent }, now = Date.now()) {
  const startTime = parseCapTime(onset) ?? parseCapTime(effective) ?? parseCapTime(sent);
  const endTime = parseCapTime(expires);
  const issuedTime = parseCapTime(sent) ?? parseCapTime(effective) ?? startTime ?? now;

  // Window already closed - the authority no longer shows this alert
  if (endTime !== null && endTime <= now) return null;

  // Onset too far out to be worth surfacing as an alert
  if (startTime !== null && startTime - now > UPCOMING_LEAD_MS) return null;

  const isUpcoming = startTime !== null && startTime > now;

  return {
    time: issuedTime,
    startTime: startTime ?? issuedTime,
    endTime,
    isUpcoming,
    startsInMinutes: isUpcoming ? Math.round((startTime - now) / 60000) : 0,
    minutesAgo: Math.round((now - issuedTime) / 60000)
  };
}

// CAP messages that must never surface as a live alert: cancellations,
// acknowledgements/errors, and anything that is not a real-world event
// (Test, Exercise, Draft, System).
function isCapMessageLive({ status, msgType }) {
  if (msgType && msgType !== 'Alert' && msgType !== 'Update') return false;
  if (status && status !== 'Actual') return false;
  return true;
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

      // Skip cancellations and test messages
      if (!isCapMessageLive({ status: props.status, msgType: props.messageType })) continue;

      // Skip alerts outside their validity window. NWS uses `ends` for the
      // event window and `expires` for the message itself; prefer `ends`.
      const window = getAlertWindow({
        onset: props.onset,
        effective: props.effective,
        expires: props.ends || props.expires,
        sent: props.sent
      });
      if (!window) continue;

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
            relevance,
            place: props.areaDesc || props.headline || eventType,
            headline: props.headline,
            severity,
            locationName: location.name,
            eventLat: alertLat,
            eventLon: alertLon,
            nwsEvent: eventType,
            url: `https://alerts.weather.gov`,
            ...window
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

      if (!guid || seenIds.includes(guid)) continue;
      if (!link) continue;

      // The RSS item carries no validity window or severity, so fetch the CAP
      // document it links to. Without it we cannot tell a warning in effect
      // from one that expired or that starts days from now.
      const doc = await fetchCapDocument(link);
      if (!doc || !isCapMessageLive(doc)) continue;

      // Determine event type from the headline
      let eventType = 'weather';
      if (title) {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('rain')) eventType = 'rain';
        else if (lowerTitle.includes('snow')) eventType = 'snow';
        else if (lowerTitle.includes('wind')) eventType = 'wind';
        else if (lowerTitle.includes('thunderstorm')) eventType = 'thunderstorm';
      }

      for (const location of nzLocations) {
        const info = findCapInfoForLocation(doc, location);
        if (!info) continue;

        const window = getAlertWindow(info);
        if (!window) continue;

        const severity = info.severity || 'Moderate';
        let { alertLevel, relevance } = mapWeatherSeverity(severity);
        // Severe thunderstorm warnings elevate one step
        if (eventType === 'thunderstorm' && severity === 'Severe') {
          ({ alertLevel, relevance } = elevateAlertLevel({ alertLevel, relevance }));
        }

        if (alertLevel !== 'info') {
          seenIds.push(guid);
          alerts.push({
            id: guid,
            type: 'severe_weather',
            alertLevel,
            severity,
            eventType,
            relevance,
            place: info.areaDesc || title || 'New Zealand',
            headline: info.headline || title,
            description: info.description || description,
            locationName: location.name,
            source: 'MetService',
            url: link,
            ...window
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
// CAP DOCUMENT PARSING
// ============================================
// Shared by every source that fetches full CAP XML (SMN, MetService,
// MeteoChile). Service workers have no DOMParser, so we parse with regex.

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

// Parse a CAP polygon string "lat,lon lat,lon ..." into [[lat, lon], ...]
function parseCapPolygon(polygonStr) {
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

// Parse a CAP XML document into its alert-level fields plus every <info>
// block. A single alert can carry several info blocks (different timeframes,
// severities or languages) and each can carry several <area> polygons, so
// severity and timing must be read from the block that actually covers the
// user - not from whichever appears first in the document.
function parseCapDocument(text) {
  const getTag = (xml, tag) => {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return match ? match[1].trim() : null;
  };

  const getTagContent = (xml, tag) => {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return match ? match[1].trim() : null;
  };

  const sent = getTag(text, 'sent');

  const infos = [...text.matchAll(/<info>([\s\S]*?)<\/info>/g)].map(m => m[1]).map(info => ({
    language: getTag(info, 'language'),
    event: getTag(info, 'event'),
    headline: getTag(info, 'headline'),
    description: getTagContent(info, 'description'),
    severity: getTag(info, 'severity'),
    urgency: getTag(info, 'urgency'),
    certainty: getTag(info, 'certainty'),
    onset: getTag(info, 'onset'),
    effective: getTag(info, 'effective'),
    expires: getTag(info, 'expires'),
    areaDesc: getTag(info, 'areaDesc'),
    sent,
    polygons: [...info.matchAll(/<polygon>([^<]+)<\/polygon>/g)]
      .map(m => parseCapPolygon(m[1]))
      .filter(Boolean)
  }));

  return {
    status: getTag(text, 'status'),
    msgType: getTag(text, 'msgType'),
    sent,
    infos
  };
}

// Fetch and parse a CAP XML document. Returns null on any failure.
async function fetchCapDocument(url) {
  try {
    // Rewrite http:// to https:// to avoid CORS-blocked redirects
    const response = await fetch(url.replace(/^http:\/\//, 'https://'), {
      headers: { 'Accept': 'application/xml, text/xml' }
    });
    if (!response.ok) return null;
    return parseCapDocument(await response.text());
  } catch (err) {
    console.error('Weather Clock: Error fetching CAP document:', url, err);
    return null;
  }
}

// Pick the info block covering a location, or null when none does.
// Documents that carry no polygons at all fall back to their first info block,
// since there is nothing to match against - pass requirePolygon to drop those
// instead, for feeds where an alert without geometry means "not for you".
function findCapInfoForLocation(doc, location, { requirePolygon = false } = {}) {
  const withPolygons = doc.infos.filter(info => info.polygons.length > 0);
  if (withPolygons.length === 0) {
    return requirePolygon ? null : (doc.infos[0] || null);
  }

  for (const info of withPolygons) {
    const match = info.polygons.find(p => pointInPolygon(location.lat, location.lon, p));
    if (match) return { ...info, polygon: match };
  }
  return null;
}

// ============================================
// ARGENTINA SMN CAP CHECKING
// https://ssl.smn.gob.ar/CAP/AR.php - Servicio Meteorológico Nacional
// Fetches RSS feed, then individual CAP XMLs for polygon intersection
// ============================================

// Fetch individual CAP XML and check if location is within polygon
async function fetchSMNAlertDetail(alertUrl, location) {
  const doc = await fetchCapDocument(alertUrl);
  if (!doc) return null;

  // Cancellations and test messages must never surface as live alerts
  if (!isCapMessageLive(doc)) return null;

  // SMN always geocodes its alerts, so a document we cannot match to the
  // user's polygon is an alert for somewhere else
  return findCapInfoForLocation(doc, location, { requirePolygon: true });
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
          else if (eventType.includes('nieve') || eventType.includes('nevada')) phenomenon = 'nieve';
          else if (eventType.includes('calor') || eventType.includes('temperatura')) phenomenon = 'calor';
          else if (eventType.includes('frio') || eventType.includes('helada')) phenomenon = 'frio';
          
          const alertTypeKey = `${phenomenon}-${severity}`;

          // Drop alerts that already expired or start too far ahead. Checked
          // before seenIds is touched so an alert that is merely too early
          // still gets picked up once its onset comes within range.
          const window = getAlertWindow(detail);
          if (!window) return null;

          const { alertLevel, relevance } = mapWeatherSeverity(severity);
          if (alertLevel === 'info') return null;

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

          return {
            id: `smn-${alertTypeKey}-${location.name}`,
            type: 'severe_weather',
            alertLevel,
            severity,
            eventType: phenomenon,
            relevance: Math.round(relevance * 10) / 10,
            place: detail.event || title,
            headline: detail.headline || title,
            description: detail.description || description,
            locationName: location.name,
            source: 'SMN Argentina',
            url: 'https://www.smn.gob.ar/alertas',
            ...window
          };
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      alerts.push(...batchResults.filter(a => a !== null));
    }
    
    if (alerts.length > 0) {
      console.log(`Weather Clock: SMN ${alerts.length}/${alertLinks.length} alerts match user locations:`,
        alerts.map(a => `${a.severity} ${a.eventType} for ${a.locationName}` +
          (a.isUpcoming ? ` (starts in ${a.startsInMinutes}min)` : ' (in effect)')));
    }
    
  } catch (err) {
    console.error('Weather Clock: Argentina SMN check error:', err);
  }
  
  return alerts;
}

// ============================================
// EUROPE METEOALARM CAP CHECKING
// https://feeds.meteoalarm.org/ - per-country Atom feeds
// ============================================
// MeteoAlarm identifies the affected area by EMMA region code and name only:
// its feeds, its per-alert CAP documents and its JSON API all omit geometry,
// and the EDR API that supports spatial queries is restricted to members.
// Without geometry the best we could do is country-level filtering, which
// means 182 alerts for Spain or 540 for Germany regardless of where the user
// actually is. So we ship the EMMA region polygons ourselves (see
// data/emma-regions.json) and resolve the user's location locally.
//
// The aggregated Europe feed was retired upstream, so each country is
// fetched from its own feed.
const METEOALARM_FEED_SLUGS = {
  AT: 'austria', BA: 'bosnia-herzegovina', BE: 'belgium', BG: 'bulgaria',
  CY: 'cyprus', CZ: 'czechia', DE: 'germany', DK: 'denmark', EE: 'estonia',
  ES: 'spain', FI: 'finland', FR: 'france', GR: 'greece', HR: 'croatia',
  HU: 'hungary', IE: 'ireland', IL: 'israel', IS: 'iceland', IT: 'italy',
  LT: 'lithuania', LU: 'luxembourg', LV: 'latvia', MD: 'moldova',
  ME: 'montenegro', MK: 'republic-of-north-macedonia', MT: 'malta',
  NL: 'netherlands', NO: 'norway', PL: 'poland', PT: 'portugal',
  RO: 'romania', RS: 'serbia', SE: 'sweden', SI: 'slovenia', SK: 'slovakia'
};

// EMMA region polygons, loaded once on first European lookup
let emmaRegionsCache = null;

async function loadEmmaRegions() {
  if (emmaRegionsCache) return emmaRegionsCache;
  try {
    const response = await fetch(chrome.runtime.getURL('data/emma-regions.json'));
    const data = await response.json();
    emmaRegionsCache = data.regions || [];
    console.log(`Weather Clock: loaded ${emmaRegionsCache.length} EMMA regions`);
  } catch (err) {
    console.error('Weather Clock: could not load EMMA regions:', err);
    emmaRegionsCache = [];
  }
  return emmaRegionsCache;
}

// Region names are compared across languages and spellings, so strip accents
// and punctuation before matching. Mirrors the normalisation baked into the
// dataset's `n` field.
function normalizeRegionName(name) {
  return (name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Point-in-polygon over GeoJSON-ordered rings ([lon, lat])
function pointInGeoRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) &&
        (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Resolve a location to the EMMA regions covering it. Returns null when the
// point falls outside every region we have geometry for (open sea, or a
// MeteoAlarm country missing from the dataset such as CH, UA or GB).
async function findEmmaRegions(lat, lon) {
  const regions = await loadEmmaRegions();
  const codes = new Set();
  const names = new Set();
  let country = null;

  for (const region of regions) {
    const [minLon, minLat, maxLon, maxLat] = region.b;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
    if (!region.p.some(ring => pointInGeoRing(lat, lon, ring))) continue;

    codes.add(region.c);
    names.add(region.n);
    country = country || region.k;
  }

  return country ? { country, codes, names } : null;
}

async function checkMeteoAlarm(locations, seenIds) {
  const alerts = [];

  const euLocations = locations.filter(loc => isInEurope(loc.lat, loc.lon));
  if (euLocations.length === 0) return alerts;

  // Group locations by the country feed they need, so each feed is fetched once
  const byFeed = new Map();
  for (const location of euLocations) {
    const region = await findEmmaRegions(location.lat, location.lon);
    if (!region) {
      console.log(`Weather Clock: MeteoAlarm has no region geometry covering ${location.name}`);
      continue;
    }
    const slug = METEOALARM_FEED_SLUGS[region.country];
    if (!slug) {
      console.log(`Weather Clock: no MeteoAlarm feed for country ${region.country}`);
      continue;
    }
    if (!byFeed.has(slug)) byFeed.set(slug, []);
    byFeed.get(slug).push({ location, region });
  }

  for (const [slug, targets] of byFeed) {
    try {
      await checkMeteoAlarmFeed(slug, targets, seenIds, alerts);
    } catch (err) {
      console.error(`Weather Clock: MeteoAlarm ${slug} check error:`, err);
    }
  }

  return alerts;
}

async function checkMeteoAlarmFeed(slug, targets, seenIds, alerts) {
  // The feed server answers 406 to any specific XML Accept type, so ask for */*
  const response = await fetch(`${APIS.meteoalarmFeedBase}${slug}`, {
    headers: { 'Accept': '*/*' }
  });
  if (!response.ok) {
    console.log(`Weather Clock: MeteoAlarm ${slug} returned`, response.status);
    return;
  }

  const text = await response.text();
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  const items = [...text.matchAll(entryRegex)];
  let matched = 0;

  for (const itemMatch of items) {
      const itemXml = itemMatch[1];

      const getTag = (tag) => {
        const match = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return match ? match[1].trim() : null;
      };
      
      const id = getTag('id') || getTag('cap:identifier');
      const title = getTag('title') || getTag('cap:event');
      const areaDesc = getTag('cap:areaDesc');
      const summary = getTag('summary') || areaDesc;
      const updated = getTag('updated') || getTag('cap:sent');

      if (!id || seenIds.includes(id)) continue;

      // MeteoAlarm entries carry the CAP fields inline under the cap: prefix
      if (!isCapMessageLive({
        status: getTag('cap:status'),
        msgType: getTag('cap:message_type')
      })) continue;

      // Which EMMA region this warning covers. France renumbered its codes,
      // so fall back to matching the region name when the code is unknown.
      const entryCodes = [...itemXml.matchAll(/<value>([A-Z]{2}\d+)<\/value>/g)].map(m => m[1]);
      const entryName = normalizeRegionName(areaDesc);

      // Only keep the warning if it covers a region the user is actually in
      const affected = targets.filter(({ region }) =>
        entryCodes.some(code => region.codes.has(code)) ||
        (entryName && region.names.has(entryName))
      );
      if (affected.length === 0) continue;

      const window = getAlertWindow({
        onset: getTag('cap:onset'),
        effective: getTag('cap:effective'),
        expires: getTag('cap:expires'),
        sent: getTag('cap:sent') || updated
      });
      if (!window) continue;

      seenIds.push(id);

      // Prefer the declared severity; fall back to reading the awareness colour
      let severity = getTag('cap:severity');
      let eventType = 'weather';

      if (!severity && (title || summary)) {
        const colour = (title + ' ' + (summary || '')).toLowerCase();
        if (colour.includes('red') || colour.includes('extreme')) severity = 'Severe';
        else if (colour.includes('orange')) severity = 'Moderate';
        else if (colour.includes('yellow')) severity = 'Minor';
        else severity = 'Moderate';
      }

      // Event wording varies by issuing service ("strong heat", "Heatwarning",
      // "Moderate high-temperature warning"), so check the specific phenomena
      // before the generic ones - thunderstorm entries often also say "gusts".
      if (title || summary) {
        const content = (title + ' ' + (summary || '')).toLowerCase();
        if (content.includes('thunder')) eventType = 'thunderstorm';
        else if (content.includes('heat') || content.includes('high-temperature') ||
                 content.includes('calor')) eventType = 'heat';
        else if (content.includes('low-temperature') || content.includes('cold') ||
                 content.includes('frost')) eventType = 'cold';
        else if (content.includes('snow') || content.includes('nieve') ||
                 content.includes('avalanche')) eventType = 'snow';
        else if (content.includes('flood')) eventType = 'flood';
        else if (content.includes('rain') || content.includes('lluvia')) eventType = 'rain';
        else if (content.includes('wind') || content.includes('gust') ||
                 content.includes('gale') || content.includes('storm') ||
                 content.includes('viento')) eventType = 'wind';
        else if (content.includes('fog')) eventType = 'fog';
        else if (content.includes('coastal')) eventType = 'coastal';
        else if (content.includes('forest') || content.includes('fire')) eventType = 'wildfire';
      }

      const { alertLevel, relevance } = mapWeatherSeverity(severity);
      if (alertLevel === 'info') continue;
      matched++;

      for (const { location } of affected) {
        alerts.push({
          id: `${id}-${location.name}`,
          type: 'severe_weather',
          alertLevel,
          severity,
          eventType,
          relevance,
          place: areaDesc || title || 'Europe',
          headline: title,
          description: summary,
          locationName: location.name,
          source: 'MeteoAlarm',
          url: 'https://www.meteoalarm.org',
          ...window
        });
      }
  }

  console.log(`Weather Clock: MeteoAlarm ${slug} - ${matched}/${items.length} warnings cover the user's regions`);
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

      // INMET publishes the window inside the description table as
      // "Início" / "Fim" rows, with naive timestamps. pubDate repeats Início
      // with an explicit offset, so we parse both against that same offset to
      // stay consistent with the feed.
      const fieldFromTable = (label) => {
        const match = (description || '').match(
          new RegExp(`>\\s*${label}\\s*</th>\\s*<td>([^<]*)</td>`, 'i')
        );
        return match ? match[1].trim() : null;
      };
      const offsetMatch = (pubDate || '').match(/([+-])(\d{2}):?(\d{2})\s*$/);
      const offset = offsetMatch
        ? `${offsetMatch[1]}${offsetMatch[2]}:${offsetMatch[3]}`
        : 'Z';
      const toIso = (naive) => {
        if (!naive) return null;
        const match = naive.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
        return match ? `${match[1]}T${match[2]}${offset}` : null;
      };

      const window = getAlertWindow({
        onset: toIso(fieldFromTable('Início')) || pubDate,
        expires: toIso(fieldFromTable('Fim')),
        sent: pubDate
      });
      if (!window) continue;

      seenIds.push(guid);

      // INMET grades severity as Perigo Potencial (yellow) < Perigo (orange)
      // < Grande Perigo (red). Check the longest label first so "Perigo
      // Potencial" is not read as the more serious plain "Perigo".
      let severity = 'Moderate';
      let eventType = 'weather';
      const grade = `${title || ''} ${fieldFromTable('Severidade') || ''}`.toLowerCase();

      if (grade.includes('grande perigo') || grade.includes('vermelho')) severity = 'Severe';
      else if (grade.includes('perigo potencial') || grade.includes('amarelo')) severity = 'Minor';
      else if (grade.includes('perigo') || grade.includes('laranja')) severity = 'Moderate';

      if (title) {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('chuva') || lowerTitle.includes('precipitação')) eventType = 'rain';
        else if (lowerTitle.includes('tempestade')) eventType = 'thunderstorm';
        else if (lowerTitle.includes('vento')) eventType = 'wind';
        else if (lowerTitle.includes('onda de calor')) eventType = 'heat';
      }

      for (const location of brLocations) {
        const { alertLevel, relevance } = mapWeatherSeverity(severity);

        if (alertLevel !== 'info') {
          alerts.push({
            id: guid,
            type: 'severe_weather',
            alertLevel,
            severity,
            eventType,
            relevance,
            place: title || 'Brasil',
            headline: title,
            description,
            locationName: location.name,
            source: 'INMET Brasil',
            url: 'https://alertas2.inmet.gov.br',
            ...window
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
      
      const link = getTag('link');
      const guid = getTag('guid') || link;
      const title = getTag('title');
      const description = getTag('description');

      if (!guid || seenIds.includes(guid)) continue;
      if (!link) continue;

      // Each RSS item links to a CAP document holding the real severity and
      // validity window - the item title only says "Aviso"/"Alerta"
      const doc = await fetchCapDocument(link);
      if (!doc || !isCapMessageLive(doc)) continue;

      let eventType = 'weather';
      if (title) {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.includes('lluvia') || lowerTitle.includes('precipitaciones')) eventType = 'rain';
        else if (lowerTitle.includes('viento')) eventType = 'wind';
        else if (lowerTitle.includes('nieve')) eventType = 'snow';
        else if (lowerTitle.includes('tormenta')) eventType = 'thunderstorm';
        else if (lowerTitle.includes('marejada')) eventType = 'coastal';
        else if (lowerTitle.includes('frío') || lowerTitle.includes('helada')) eventType = 'cold';
      }

      for (const location of clLocations) {
        const info = findCapInfoForLocation(doc, location);
        if (!info) continue;

        const window = getAlertWindow(info);
        if (!window) continue;

        const severity = info.severity || 'Moderate';
        const { alertLevel, relevance } = mapWeatherSeverity(severity);

        if (alertLevel !== 'info') {
          seenIds.push(guid);
          alerts.push({
            id: guid,
            type: 'severe_weather',
            alertLevel,
            severity,
            eventType,
            relevance,
            place: info.areaDesc || title || 'Chile',
            headline: info.headline || title,
            description: info.description || description,
            locationName: location.name,
            source: 'MeteoChile',
            url: 'https://www.meteochile.gob.cl/alertas',
            ...window
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

      // NAAD mirrors the CAP fields as <category term="key=value"/> pairs
      const categories = {};
      for (const [, term] of itemXml.matchAll(/<category term="([^"]+)"\s*\/?>/g)) {
        const separator = term.indexOf('=');
        if (separator > 0) categories[term.slice(0, separator)] = term.slice(separator + 1);
      }

      if (!isCapMessageLive({ status: categories.status, msgType: categories.msgType })) continue;

      // Entries whose event has finished are still published, titled
      // "... ended" / "... terminée"; they are not live alerts
      const lowerTitle = (title || '').toLowerCase();
      if (/\b(ended|terminée|terminé)\s*$/.test(lowerTitle)) continue;

      // The expiry time lives in the summary HTML, not in a dedicated element
      const expiresMatch = (summary || '').match(/Expires:\s*([0-9T:+\-.]+)/);
      const window = getAlertWindow({
        expires: expiresMatch ? expiresMatch[1] : null,
        sent: updated
      });
      if (!window) continue;

      seenIds.push(id);

      // Prefer the severity the issuer declared over guessing from wording
      let severity = categories.severity && categories.severity !== 'Unknown'
        ? categories.severity
        : 'Moderate';
      let eventType = 'weather';

      if (title || summary) {
        const content = (title + ' ' + (summary || '')).toLowerCase();
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
            relevance,
            place: title || 'Canada',
            headline: title,
            description: summary,
            locationName: location.name,
            source: 'NAAD Canada',
            url: 'https://weather.gc.ca/warnings/index_e.html',
            ...window
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

    // Combine old and new alerts, removing duplicates by ID.
    // An alert with a validity window is kept for exactly as long as that
    // window is open, however long ago it was issued. Only alerts without one
    // (earthquakes, hurricanes) fall back to an age cutoff.
    const combinedAlerts = [
      ...activeAlerts.filter(a => {
        if (a.endTime) return a.endTime > now;
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
    
    // Update badge - count what is happening now: alerts still inside their
    // validity window, or recently issued (3h) when they have none. Alerts
    // that have not started yet are excluded so the badge never overstates.
    const recentAlerts = activeAlerts.filter(a => {
      if (a.isUpcoming) return false;
      if (a.endTime) return a.endTime > now;
      return now - a.time < 3 * 60 * 60 * 1000;
    });
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
  
  // An alert that has not started yet must read as upcoming, never as "X ago"
  if (alert.isUpcoming) {
    message += ` • starts in ${formatLeadTime(alert.startsInMinutes)}`;
  } else if (alert.minutesAgo !== undefined && alert.minutesAgo < 120) {
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
