// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: bus;
// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-brown; icon-glyph: magic;

// PID Timetable Widget (v5.3.4)
// - Queries base and P IDs (v4.3.6 parity)
// - Groups by canonical platform (ensureP), header shows base stop name (no trailing P)

///////////////////////
// --- CONFIG ---
///////////////////////
let API_KEY = "YOUR_API_KEY";
if (Keychain.contains("PID_API_KEY")) {
  API_KEY = Keychain.get("PID_API_KEY");
}

const SEARCH_RADIUS_METERS = 250;
const MAX_PLATFORM = 5;
const SHOW_NEXT_ARRIVAL_INFO = false;
const DATABASE_FILENAME = "pid_stops_db.json";
const SORT_BY_CLOSEST_STOP_ONLY = false;
const WIDGET_VERSION = "5.4.1";

// Walking-time
const AVERAGE_WALKING_SPEED_MPS = 1.3;
const WALKING_TIME_BUFFER_MINUTES_DEFAULT = 0;
const WALKING_TIME_BUFFER_MINUTES_METRO = 0.5;
const IGNORE_WALKING_TIME_ROUNDING_UNDER_METERS = 50;

///////////////////////
// --- THEME ---
///////////////////////
const COLORS = {
  background: Color.dynamic(new Color("#F2F2F7"), new Color("#1C1C1E")),
  textPrimary: Color.dynamic(Color.black(), Color.white()),
  textSecondary: Color.dynamic(Color.darkGray(), Color.gray()),
  acBlue: Color.dynamic(new Color("#007AFF"), new Color("#5AC8FA")),
  wheelchairBlue: Color.dynamic(new Color("#007AFF"), new Color("#5AC8FA")),
  onTime: new Color("#4CAF50"),
  delayed: new Color("#FF9800"),
  imminent: new Color("#F44336"),
  badgeBus: new Color("#007AFF"),
  badgeTram: new Color("#960606"),
  badgeMetroA: new Color("#00954D"),
  badgeMetroB: Color.dynamic(new Color("#E67E00"), new Color("#FF9800")),
  badgeMetroC: new Color("#DC041D"),
};

///////////////////////
// --- GLOBAL CACHE ---
///////////////////////
let stopDatabaseCache = null;

///////////////////////
// --- MAIN ---
///////////////////////
await main();

async function main() {
  let widget;
  try {
    const stopDatabase = getStopDatabase();
    Location.setAccuracyToHundredMeters();
    const location = await Location.current();
    const gpsAccuracy = location.horizontalAccuracy;

    let { sortedStops, distanceMap } = findAndSortNearbyStops(location, stopDatabase, SEARCH_RADIUS_METERS);

    if (sortedStops.length === 0) {
      const closest = findSingleClosestStop(location, stopDatabase);
      if (closest) {
        const newRadius = closest.distance + 50;
        const expanded = findAndSortNearbyStops(location, stopDatabase, newRadius);
        sortedStops = expanded.sortedStops;
        distanceMap = expanded.distanceMap;
      } else {
        widget = createErrorWidget("No Stops Found", "Could not find any stops in the database.");
        return finalize(widget);
      }
    }

    // Query BOTH base and P-suffixed IDs (v4.3.6 parity)
    const finalStopIdsToQuery = getFinalStopIdList(sortedStops);
    const apiResponse = await getDepartureData(finalStopIdsToQuery);

    if (!apiResponse.departures || apiResponse.departures.length === 0) {
      widget = createErrorWidget("No Departures Found", "Stops found, but they have no upcoming departures.");
    } else {
      widget = await createWidget(apiResponse, distanceMap, gpsAccuracy);
    }
  } catch (e) {
    console.error(e);
    widget = createErrorWidget("Error", e.message || "Unknown error.");
  } finally {
    finalize(widget);
  }
}

function finalize(widget) {
  if (config.runsInWidget) Script.setWidget(widget);
  else (async () => { await widget.presentLarge(); })();
  Script.complete();
}

//////////////////////////////
// --- DATA & HELPERS ---
//////////////////////////////
function getStopDatabase() {
  if (stopDatabaseCache) return stopDatabaseCache;
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), DATABASE_FILENAME);
  if (!fm.fileExists(path)) {
    throw new Error(`Database '${DATABASE_FILENAME}' not found.`);
  }
  const raw = fm.readString(path);
  const db = JSON.parse(raw);
  stopDatabaseCache = db;
  return db;
}

function findSingleClosestStop(location, stopDatabase) {
  if (!stopDatabase || stopDatabase.length === 0) return null;
  return stopDatabase
    .map(stop => ({
      id: stop.id,
      name: stop.name,
      distance: haversineDistance(location.latitude, location.longitude, stop.lat, stop.lon),
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

function findAndSortNearbyStops(location, stopDatabase, radiusMeters) {
  const { latitude, longitude } = location;
  const latDelta = radiusMeters / 111000;
  const lonDelta = radiusMeters / (111000 * Math.cos(latitude * Math.PI / 180));
  const minLat = latitude - latDelta;
  const maxLat = latitude + latDelta;
  const minLon = longitude - lonDelta;
  const maxLon = longitude + lonDelta;

  const nearby = [];
  const distanceMap = {};
  const box = stopDatabase.filter(
    s => s.lat >= minLat && s.lat <= maxLat && s.lon >= minLon && s.lon <= maxLon
  );

  box.forEach(s => {
    const d = haversineDistance(latitude, longitude, s.lat, s.lon);
    if (d <= radiusMeters) {
      nearby.push({ id: s.id, distance: d });
      const baseId = s.id.endsWith('P') ? s.id.slice(0, -1) : s.id;
      distanceMap[baseId] = d;
    }
  });

  return { sortedStops: nearby.sort((a, b) => a.distance - b.distance), distanceMap };
}

// v4.3.6-compatible: add base and P for each seen stop id
function getFinalStopIdList(sortedStops) {
  const idSet = new Set();
  const list = SORT_BY_CLOSEST_STOP_ONLY ? sortedStops.slice(0, 1) : sortedStops;
  list.forEach(s => {
    const base = s.id.endsWith('P') ? s.id.slice(0, -1) : s.id;
    idSet.add(base);
    idSet.add(base + 'P');
  });
  return Array.from(idSet);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function getDepartureData(stopIds) {
  const idParams = stopIds.map(id => `ids[]=${encodeURIComponent(id)}`).join('&');
  const url = `https://api.golemio.cz/v2/pid/departureboards?${idParams}&limit=60&minutesAfter=90&includeMetroTrains=true`;
  const req = new Request(url);
  req.headers = { "X-Access-Token": API_KEY };
  return await req.loadJSON();
}

function getBadgeBackgroundColor(dep) {
  switch (dep.route.type) {
    case 1:
      switch (dep.route.short_name) {
        case 'A': return COLORS.badgeMetroA;
        case 'B': return COLORS.badgeMetroB;
        case 'C': return COLORS.badgeMetroC;
        default: return COLORS.badgeBus;
      }
    case 0:
      return COLORS.badgeTram;
    default:
      return COLORS.badgeBus;
  }
}

//////////////////////////////
// --- WIDGET (grouped) ---
//////////////////////////////
async function createWidget(apiResponse, distanceMap, gpsAccuracy) {
  const { departures, stops } = apiResponse;

  // Metadata keyed by baseId; also accessible by baseId+'P'
  const stopDataMap = {};
  if (stops) {
    stops.forEach(s => {
      const baseId = s.stop_id.endsWith('P') ? s.stop_id.slice(0, -1) : s.stop_id;
      const shared = {
        name: s.stop_name,
        distance: distanceMap[baseId],
      };
      stopDataMap[baseId] = shared;
      stopDataMap[baseId + 'P'] = shared;
    });
  }

  const widget = new ListWidget();
  widget.backgroundColor = COLORS.background;
  widget.setPadding(12, 16, 12, 16);

  // Handle widget parameters for refresh
  if (config.runsInWidget && args.widgetParameter) {
    const minutes = parseInt(args.widgetParameter);
    if (!isNaN(minutes) && minutes > 0) {
      widget.refreshAfterDate = new Date(Date.now() + (minutes * 60 * 1000));
    }
  }

  widget.addSpacer(2);

  // Deduplicate trips by closest physical stop
  const getDist = (stopId) => {
    const baseId = stopId.endsWith('P') ? stopId.slice(0, -1) : stopId;
    const d = distanceMap[baseId];
    return typeof d === "number" ? d : Infinity;
  };

  const uniqueByTrip = new Map();
  for (const dep of departures) {
    const tId = dep.trip.id;
    const curr = uniqueByTrip.get(tId);
    if (!curr || getDist(dep.stop.id) < getDist(curr.stop.id)) {
      uniqueByTrip.set(tId, dep);
    }
  }
  const dedup = Array.from(uniqueByTrip.values());

  // Timetable grouped by route|canonical platform (ensureP)
  const timetable = {};
  for (const dep of dedup) {
    const platformKey = ensureP(dep.stop.id);
    const key = `${dep.route.short_name}|${platformKey}`;
    if (!timetable[key]) timetable[key] = [];
    timetable[key].push({
      time: new Date(dep.departure_timestamp.predicted || dep.departure_timestamp.scheduled),
      isAC: dep.trip.is_air_conditioned,
    });
  }
  Object.keys(timetable).forEach(k => timetable[k].sort((a, b) => a.time - b.time));

  // Catchability
  const now = new Date();
  const catchable = dedup.filter(dep => {
    const baseId = (ensureP(dep.stop.id)).slice(0, -1);
    const distance = distanceMap[baseId];
    if (typeof distance !== "number") return true;

    const predicted = new Date(dep.departure_timestamp.predicted || dep.departure_timestamp.scheduled);
    const secondsUntil = (predicted - now) / 1000;
    const walking = distance / AVERAGE_WALKING_SPEED_MPS;

    let required = (distance < IGNORE_WALKING_TIME_ROUNDING_UNDER_METERS)
      ? walking
      : Math.ceil(walking / 60) * 60;

    const buffer = (dep.route.type === 1)
      ? WALKING_TIME_BUFFER_MINUTES_METRO * 60
      : WALKING_TIME_BUFFER_MINUTES_DEFAULT * 60;

    required += buffer;
    return secondsUntil >= required;
  });

  // Order globally
  const stream = catchable
    .map(dep => ({
      dep,
      stopIdP: ensureP(dep.stop.id), // canonical platform key
      predicted: new Date(dep.departure_timestamp.predicted || dep.departure_timestamp.scheduled),
    }))
    .sort((a, b) => {
      const dt = a.predicted - b.predicted;
      if (dt !== 0) return dt;
      const da = getDist(a.stopIdP);
      const db = getDist(b.stopIdP);
      if (da !== db) return da - db;
      if (a.dep.route.short_name !== b.dep.route.short_name) {
        return a.dep.route.short_name.localeCompare(b.dep.route.short_name);
      }
      return 0;
    });

  // Dynamic rows based on platforms present
  const MAX_PREVIEW_ROWS = 12;
  let previewRows = stream.slice(0, MAX_PREVIEW_ROWS);

  const previewBuckets = new Map();
  for (const it of previewRows) {
    if (!previewBuckets.has(it.stopIdP)) previewBuckets.set(it.stopIdP, []);
    previewBuckets.get(it.stopIdP).push(it);
  }
  const platformCount = previewBuckets.size;

  let TOTAL_ROWS;
  if (platformCount == 1) TOTAL_ROWS = 11;
  else if (platformCount == 2) TOTAL_ROWS = 10;
  else if (platformCount == 3) TOTAL_ROWS = 9;
  else if (platformCount == 4) TOTAL_ROWS = 8;
  else TOTAL_ROWS = 7;

  const picked = stream.slice(0, TOTAL_ROWS);

  // Consolidate strictly by canonical platform to avoid split headers
  const buckets = new Map();
  for (const it of picked) {
    if (!buckets.has(it.stopIdP)) buckets.set(it.stopIdP, []);
    buckets.get(it.stopIdP).push(it);
  }

  // Order platforms by earliest selected time
  const platformOrder = Array.from(buckets.entries())
    .map(([stopIdP, arr]) => ({ stopIdP, earliest: arr[0].predicted }))
    .sort((a, b) => a.earliest - b.earliest)
    .map(x => x.stopIdP);

  // Render
  if (platformOrder.length === 0) {
    widget.addSpacer();
    const label = widget.addText("No catchable departures found.");
    label.font = Font.mediumSystemFont(12);
    label.textColor = COLORS.textSecondary;
    label.centerAlignText();
    widget.addSpacer();
  } else {
    if (config.widgetFamily === "medium") {
      // Medium Widget: 2 columns side-by-side
      const hStack = widget.addStack();
      hStack.layoutHorizontally();

      const leftStack = hStack.addStack();
      leftStack.layoutVertically();

      hStack.addSpacer(12);

      const rightStack = hStack.addStack();
      rightStack.layoutVertically();

      const platformsToShow = platformOrder.slice(0, 2); // Max 2 platforms

      platformsToShow.forEach((stopIdP, index) => {
        const stack = index === 0 ? leftStack : rightStack;
        const arr = buckets.get(stopIdP) || [];
        // Limit to 3 departures per platform for medium view
        const departuresToShow = arr.slice(0, 3);

        renderPlatformBlock(stack, stopIdP, departuresToShow, stopDataMap, timetable, now, true);
        if (index === 0 && platformsToShow.length === 1) {
            // If only 1 platform, leave right side empty (spacer handles it)
        }
      });

    } else {
      // Large Widget (default behavior)
      widget.addSpacer(2);
      const platformsToShow = platformOrder.slice(0, MAX_PLATFORM);
      let emitted = 0;

      for (const stopIdP of platformsToShow) {
        if (emitted >= TOTAL_ROWS) break;
        const arr = buckets.get(stopIdP) || [];

        // Render manually to track 'emitted' rows count for dynamic height
        const baseId = stopIdP.slice(0, -1);
        const info = stopDataMap[baseId] || stopDataMap[stopIdP] || {};
        const stopName = info.name || (arr[0]?.dep?.stop?.name) || "";
        const platformCode = (arr[0]?.dep?.stop?.platform_code) || "";

        renderHeader(widget, stopName, platformCode, info.distance);
        widget.addSpacer(5);

        for (const it of arr) {
            if (emitted >= TOTAL_ROWS) break;
            renderDepartureRow(widget, it.dep, timetable, now, false);
            emitted += 1;
            widget.addSpacer(4);
        }
        widget.addSpacer(2);
      }
    }
  }

  // Footer
  const footer = widget.addStack();
  footer.layoutHorizontally();
  footer.centerAlignContent();

  const leftF = footer.addStack();
  leftF.centerAlignContent();
  // Logo removed
  footer.addSpacer();
  footer.addSpacer();

  const rightF = footer.addStack();
  rightF.layoutHorizontally();
  rightF.centerAlignContent();

  if (typeof gpsAccuracy === "number" && isFinite(gpsAccuracy)) {
    const acc = rightF.addText(`GPS: ±${Math.round(gpsAccuracy)}m`);
    acc.font = Font.systemFont(9);
    acc.textColor = COLORS.textSecondary;
    acc.textOpacity = 0.8;
    rightF.addSpacer(6);
  }

  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const ver = rightF.addText(`• v${WIDGET_VERSION} • ${ts}`);
  ver.font = Font.systemFont(9);
  ver.textColor = COLORS.textSecondary;
  ver.textOpacity = 0.8;

  return widget;
}

function renderPlatformBlock(widget, stopIdP, arr, stopDataMap, timetable, now, isSimplified) {
  const baseId = stopIdP.slice(0, -1);
  const info = stopDataMap[baseId] || stopDataMap[stopIdP] || {};
  const stopName = info.name || (arr[0]?.dep?.stop?.name) || "";
  const platformCode = (arr[0]?.dep?.stop?.platform_code) || "";

  renderHeader(widget, stopName, platformCode, info.distance);
  widget.addSpacer(5);

  for (const it of arr) {
    renderDepartureRow(widget, it.dep, timetable, now, isSimplified);
    widget.addSpacer(4);
  }
}

function renderHeader(widget, stopName, platformCode, distance) {
  const walkingSeconds = typeof distance === "number" ? (distance / AVERAGE_WALKING_SPEED_MPS) : 0;
  let walkLabel;
  if (typeof distance === "number" && distance < 30) {
    walkLabel = "• nearby";
  } else {
    const roundedWalking = (typeof distance === "number" && distance >= IGNORE_WALKING_TIME_ROUNDING_UNDER_METERS)
      ? Math.ceil(walkingSeconds / 60)
      : Math.max(1, Math.round(walkingSeconds / 60));
    walkLabel = `• ${roundedWalking} min walk`;
  }

  const header = widget.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  const left = header.addStack();
  const headerTitle = left.addText(platformCode ? `${stopName} — ${platformCode}` : `${stopName}`);
  headerTitle.font = Font.boldSystemFont(14);
  headerTitle.textColor = COLORS.textPrimary;
  headerTitle.lineLimit = 1;

  header.addSpacer(6);

  const walk = header.addText(walkLabel);
  walk.font = Font.systemFont(10);
  walk.textColor = COLORS.textSecondary;
}

function renderDepartureRow(widget, dep, timetable, now, isSimplified) {
  const row = widget.addStack();
  row.layoutHorizontally();
  row.centerAlignContent();
  row.spacing = 8;

  // Badge
  const badgeWrap = row.addStack();
  const badge = badgeWrap.addStack();
  badge.size = new Size(52, 0);
  badge.centerAlignContent();
  badge.setPadding(2, 6, 2, 6);
  badge.backgroundColor = getBadgeBackgroundColor(dep);
  badge.cornerRadius = 10;

  const lineText = badge.addText(dep.route.short_name);
  lineText.font = Font.heavySystemFont(14);
  lineText.textColor = Color.white();
  lineText.lineLimit = 1;

  // Slim divider
  const divider = row.addStack();
  divider.backgroundColor = COLORS.imminent;
  divider.size = new Size(1.5, 22);
  divider.cornerRadius = 1;

  // Middle
  const mid = row.addStack();
  mid.layoutHorizontally();
  mid.centerAlignContent();
  mid.spacing = 6;

  const headsign = mid.addText(dep.trip.headsign || "");
  headsign.font = Font.semiboldSystemFont(13);
  headsign.textColor = COLORS.textPrimary;
  headsign.lineLimit = 1;

  const predicted = new Date(dep.departure_timestamp.predicted || dep.departure_timestamp.scheduled);

  // Indicators (Delayed, AC, Wheelchair, Next Arrival)
  // Only show if NOT simplified (Large widget only)
  if (!isSimplified) {
      const ind = mid.addStack();
      ind.layoutHorizontally();
      ind.centerAlignContent();
      ind.spacing = 4;

      const scheduled = dep.departure_timestamp.scheduled ? new Date(dep.departure_timestamp.scheduled) : null;
      let isDelayed = false;
      let delayMinutes = 0;
      if (scheduled) {
        const delaySeconds = Math.max(0, (predicted - scheduled) / 1000);
        isDelayed = delaySeconds > 59;
        delayMinutes = Math.round(delaySeconds / 60);
      }
      if (isDelayed && delayMinutes > 0) {
        const dc = ind.addText(`+${delayMinutes}`);
        dc.font = Font.systemFont(10);
        dc.textColor = COLORS.delayed;
      }

      if (dep.trip.is_wheelchair_accessible) {
        const w = ind.addText("♿︎");
        w.font = Font.systemFont(14);
        w.textColor = COLORS.wheelchairBlue;
      }
      if (dep.trip.is_air_conditioned) {
        const a = ind.addText("❄︎");
        a.font = Font.systemFont(12);
        a.textColor = COLORS.acBlue;
      }

      ind.addSpacer(0);

      if (SHOW_NEXT_ARRIVAL_INFO) {
        const key = `${dep.route.short_name}|${ensureP(dep.stop.id)}`;
        const arrs = timetable[key] || [];
        const idx = arrs.findIndex(t => t.time.getTime() === predicted.getTime());
        if (idx > -1 && idx < arrs.length - 1) {
          const next = arrs[idx + 1];
          const nextMinutes = Math.floor((next.time - now) / 60000);
          let teaser;
          if (nextMinutes > 10) {
            const hh = next.time.getHours().toString().padStart(2, '0');
            const mm = next.time.getMinutes().toString().padStart(2, '0');
            teaser = `➜ ${hh}:${mm}`;
          } else {
            teaser = `➜ ${nextMinutes} min`;
          }
          const nextLabel = ind.addText(teaser);
          nextLabel.font = Font.systemFont(10);
          nextLabel.textColor = COLORS.textSecondary;
          nextLabel.textOpacity = 0.5;
        }
      }
  }

  row.addSpacer();

  const minutesUntil = Math.floor((predicted - now) / 60000);
  const right = row.addStack();
  right.layoutHorizontally();
  right.centerAlignContent();
  right.spacing = 4;

  // Recalculate delay status for color logic (repeated since it was inside if block above)
  const scheduled = dep.departure_timestamp.scheduled ? new Date(dep.departure_timestamp.scheduled) : null;
  let isDelayed = false;
  if (scheduled) {
    const delaySeconds = Math.max(0, (predicted - scheduled) / 1000);
    isDelayed = delaySeconds > 59;
  }

  const timeColor = (minutesUntil <= 2) ? COLORS.imminent : (isDelayed ? COLORS.delayed : COLORS.onTime);
  const timeLabel = right.addText(minutesUntil > 10 ? fmtClock(predicted) : `${minutesUntil}`);
  timeLabel.font = Font.boldSystemFont(16);
  timeLabel.textColor = timeColor;
  timeLabel.rightAlignText();
}

//////////////////////////////
// --- UTILS ---
//////////////////////////////
function ensureP(id) {
  return id.endsWith('P') ? id : id + 'P';
}

function fmtClock(d) {
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

async function loadImage(url) {
  const req = new Request(url);
  return await req.loadImage();
}

function createErrorWidget(title, message) {
  const widget = new ListWidget();
  widget.backgroundColor = COLORS.background;
  widget.setPadding(16, 16, 16, 16);

  const t = widget.addText(title);
  t.textColor = COLORS.imminent;
  t.font = Font.boldSystemFont(16);

  widget.addSpacer(4);

  const m = widget.addText(message);
  m.textColor = COLORS.textSecondary;
  m.font = Font.systemFont(14);

  widget.addSpacer();

  const footer = widget.addStack();
  footer.layoutHorizontally();
  footer.centerAlignContent();

  const left = footer.addStack();
  footer.addSpacer();

  const ver = footer.addText(`v${WIDGET_VERSION}`);
  ver.font = Font.systemFont(9);
  ver.textColor = COLORS.textSecondary;
  ver.textOpacity = 0.8;

  return widget;
}