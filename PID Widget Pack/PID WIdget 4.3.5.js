// PID Timetable Widget (v4.3.5)
// - Added wheelchair accessibility indicator (♿) for relevant trips.
// - Includes all previous features and optimizations.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-brown; icon-glyph: magic;

// --- WIDGET CONFIGURATION ---
const API_KEY = "YOUR_API_KEY_HERE"; // Replace with your Golemio API key
const SEARCH_RADIUS_METERS = 300;
const MAX_DEPARTURES_TO_SHOW = 7;
const SHOW_NEXT_ARRIVAL_INFO = true;
const DATABASE_FILENAME = "pid_stops_db.json";
const SORT_BY_CLOSEST_STOP_ONLY = false;
const WIDGET_VERSION = "4.3.5";
const LOGO_URL = "https://raw.githubusercontent.com/alanmakareem/pid-timetable-widget/refs/heads/main/vizualni_podoba_01-scaled.png";

// --- AUTOMATED TIME CALCULATION ---
const AVERAGE_WALKING_SPEED_MPS = 1.3;
const WALKING_TIME_BUFFER_MINUTES_DEFAULT = 0;
const WALKING_TIME_BUFFER_MINUTES_METRO = 0.5;
const IGNORE_WALKING_TIME_ROUNDING_UNDER_METERS = 30;

// --- DYNAMIC COLOR THEME ---
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

// --- CACHE FOR STOP DATABASE ---
let stopDatabaseCache = null;

// --- Main script logic ---
await main();

async function main() {
    let widget;
    let isFallbackSearch = false;
    let fallbackStopData = null;

    try {
        const stopDatabase = getStopDatabase();
        const location = await Location.current();
        let { sortedStops, distanceMap } = findAndSortNearbyStops(location, stopDatabase, SEARCH_RADIUS_METERS);
        
        if (sortedStops.length === 0) {
            isFallbackSearch = true;
            const closest = findSingleClosestStop(location, stopDatabase);
            if (closest) {
                const newRadius = closest.distance + 50;
                const expandedSearch = findAndSortNearbyStops(location, stopDatabase, newRadius);
                sortedStops = expandedSearch.sortedStops;
                distanceMap = expandedSearch.distanceMap;
                fallbackStopData = closest;
            } else {
                widget = createErrorWidget("No Stops Found", "Could not find any stops in the database.");
                return;
            }
        }

        const finalStopIdsToQuery = getFinalStopIdList(sortedStops);
        const apiResponse = await getDepartureData(finalStopIdsToQuery);

        if (!apiResponse.departures || apiResponse.departures.length === 0) {
            widget = createErrorWidget("No Departures Found", "Stops found, but they have no upcoming departures.");
        } else {
            widget = await createWidget(apiResponse, distanceMap, isFallbackSearch, fallbackStopData);
        }

    } catch (e) {
        console.error(e);
        widget = createErrorWidget("Error", e.message);
    } finally {
        if (config.runsInWidget) {
            Script.setWidget(widget);
        } else {
            await widget.presentLarge();
        }
        Script.complete();
    }
}

// --- DATA FETCHING & PROCESSING FUNCTIONS ---
function getStopDatabase() {
    if (stopDatabaseCache) {
        return stopDatabaseCache;
    }

    const fm = FileManager.iCloud();
    const path = fm.joinPath(fm.documentsDirectory(), DATABASE_FILENAME);

    if (!fm.fileExists(path)) {
        throw new Error(`Database '${DATABASE_FILENAME}' not found.`);
    }

    const db = JSON.parse(fm.readString(path));
    stopDatabaseCache = db;
    return db;
}

function findSingleClosestStop(location, stopDatabase) {
    if (!stopDatabase || stopDatabase.length === 0) return null;

    return stopDatabase.map(stop => ({
        id: stop.id,
        name: stop.name,
        distance: haversineDistance(location.latitude, location.longitude, stop.lat, stop.lon)
    })).sort((a, b) => a.distance - b.distance)[0];
}

function findAndSortNearbyStops(location, stopDatabase, radiusMeters) {
    const { latitude, longitude } = location;
    const latDelta = radiusMeters / 111000;
    const lonDelta = radiusMeters / (111000 * Math.cos(latitude * Math.PI / 180));
    
    const minLat = latitude - latDelta;
    const maxLat = latitude + latDelta;
    const minLon = longitude - lonDelta;
    const maxLon = longitude + lonDelta;

    const nearbyStops = [];
    const distanceMap = {};

    const stopsInBoundingBox = stopDatabase.filter(stop =>
        stop.lat >= minLat && stop.lat <= maxLat &&
        stop.lon >= minLon && stop.lon <= maxLon
    );

    stopsInBoundingBox.forEach(stop => {
        const distance = haversineDistance(latitude, longitude, stop.lat, stop.lon);
        if (distance <= radiusMeters) {
            nearbyStops.push({ id: stop.id, distance: distance });
            distanceMap[stop.id] = distance;
        }
    });

    const sorted = nearbyStops.sort((a, b) => a.distance - b.distance);
    return { sortedStops: sorted, distanceMap: distanceMap };
}

function getFinalStopIdList(sortedStops) {
    const idSet = new Set();
    const stopsToProcess = SORT_BY_CLOSEST_STOP_ONLY ? sortedStops.slice(0, 1) : sortedStops;

    stopsToProcess.forEach(stop => {
        const baseId = stop.id;
        idSet.add(baseId);
        if (!baseId.endsWith('P')) idSet.add(`${baseId}P`);
        if (baseId.endsWith('P')) idSet.add(baseId.slice(0, -1));
    });
    return Array.from(idSet);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

async function getDepartureData(stopIds) {
    const idParams = stopIds.map(id => `ids[]=${encodeURIComponent(id)}`).join('&');
    const url = `https://api.golemio.cz/v2/pid/departureboards?${idParams}&limit=100&minutesAfter=120&includeMetroTrains=true`;
    const req = new Request(url);
    req.headers = { "X-Access-Token": API_KEY };
    return await req.loadJSON();
}

function getBadgeBackgroundColor(departure) {
    switch (departure.route.type) {
        case 1: // Metro
            switch (departure.route.short_name) {
                case 'A': return COLORS.badgeMetroA;
                case 'B': return COLORS.badgeMetroB;
                case 'C': return COLORS.badgeMetroC;
                default: return COLORS.badgeBus;
            }
        case 0: return COLORS.badgeTram; // Tram
        default: return COLORS.badgeBus;
    }
}

// --- WIDGET UI BUILDER ---
async function createWidget(apiResponse, distanceMap, isFallbackSearch, fallbackStopData) {
    const { departures, stops } = apiResponse;
    const stopDataMap = {};

    if (stops) {
        stops.forEach(stop => {
            const baseId = stop.stop_id.endsWith('P') ? stop.stop_id.slice(0, -1) : stop.stop_id;
            const pId = baseId + 'P';
            const data = { name: stop.stop_name, distance: distanceMap[baseId] };
            stopDataMap[baseId] = data;
            stopDataMap[pId] = data;
        });
    }

    const widget = new ListWidget();
    widget.backgroundColor = COLORS.background;
    widget.setPadding(14, 20, 14, 20);

    const headerStack = widget.addStack();
    headerStack.centerAlignContent();
    const logoImage = await loadImage(LOGO_URL);
    const widgetImage = headerStack.addImage(logoImage);
    widgetImage.imageSize = new Size(35, 35);
    headerStack.addSpacer();

    if (isFallbackSearch && fallbackStopData) {
        let stopName = fallbackStopData.name;
        const stopIdWithoutPlatform = fallbackStopData.id.endsWith('P') ? fallbackStopData.id.slice(0, -1) : fallbackStopData.id;
        if (!stopName && stopDataMap[stopIdWithoutPlatform]) {
            stopName = stopDataMap[stopIdWithoutPlatform].name;
        }
        const headerDisplayString = stopName ? `${stopName} ` : "Nearest stop ";
        const headerText = headerStack.addText(`${headerDisplayString}≈ ${Math.round(fallbackStopData.distance)}m`);
        headerText.font = Font.boldSystemFont(12);
        headerText.textColor = COLORS.textPrimary;
    } else {
        const headerText = headerStack.addText(`Departure ⦿ ${SEARCH_RADIUS_METERS}m`);
        headerText.font = Font.boldSystemFont(14);
        headerText.textColor = COLORS.textPrimary;
    }

    widget.addSpacer(2);

    const getDistance = (stopId) => stopDataMap[stopId] ? stopDataMap[stopId].distance : Infinity;
    
    const uniqueDepartures = new Map();
    departures.forEach(departure => {
        const tripId = departure.trip.id;
        const currentDistance = getDistance(departure.stop.id);
        if (!uniqueDepartures.has(tripId) || currentDistance < getDistance(uniqueDepartures.get(tripId).stop.id)) {
            uniqueDepartures.set(tripId, departure);
        }
    });

    const dedupedDepartures = Array.from(uniqueDepartures.values());

    const timetable = {};
    dedupedDepartures.forEach(dep => {
        const key = `${dep.route.short_name}|${dep.stop.id}`;
        if (!timetable[key]) timetable[key] = [];
        timetable[key].push({
            time: new Date(dep.departure_timestamp.predicted),
            isAC: dep.trip.is_air_conditioned
        });
    });
    Object.keys(timetable).forEach(key => {
        timetable[key].sort((a, b) => a.time - b.time);
    });

    const now = new Date();
    const filteredDepartures = dedupedDepartures.filter(dep => {
        const distance = getDistance(dep.stop.id);
        if (distance === Infinity) return true;

        const walkingTimeSeconds = distance / AVERAGE_WALKING_SPEED_MPS;
        const arrivalTime = new Date(dep.departure_timestamp.predicted);
        const secondsUntilDeparture = (arrivalTime - now) / 1000;

        let requiredTimeSeconds;

        if (distance < IGNORE_WALKING_TIME_ROUNDING_UNDER_METERS) {
            requiredTimeSeconds = walkingTimeSeconds;
        } else {
            requiredTimeSeconds = Math.ceil(walkingTimeSeconds / 60) * 60;
        }
        
        const bufferSeconds = (dep.route.type === 1) 
            ? WALKING_TIME_BUFFER_MINUTES_METRO * 60 
            : WALKING_TIME_BUFFER_MINUTES_DEFAULT * 60;
            
        requiredTimeSeconds += bufferSeconds;

        return secondsUntilDeparture >= requiredTimeSeconds;
    });

    const sortedDepartures = filteredDepartures.sort((a, b) => new Date(a.departure_timestamp.predicted) - new Date(b.departure_timestamp.predicted)).slice(0, MAX_DEPARTURES_TO_SHOW);
    
    if (sortedDepartures.length === 0) {
        widget.addSpacer();
        let noDeparturesText = widget.addText("No catchable departures found.");
        noDeparturesText.font = Font.mediumSystemFont(12);
        noDeparturesText.textColor = COLORS.textSecondary;
        noDeparturesText.centerAlignText();
        widget.addSpacer();
    } else {
        sortedDepartures.forEach((departure) => {
            const arrivalTime = new Date(departure.departure_timestamp.predicted);
            const minutesUntil = Math.floor((arrivalTime - now) / (1000 * 60));

            const rowStack = widget.addStack();
            rowStack.layoutHorizontally();
            rowStack.centerAlignContent();
            rowStack.spacing = 10;

            const lineInfoStack = rowStack.addStack();
            lineInfoStack.layoutVertically();
            lineInfoStack.centerAlignContent();
            lineInfoStack.size = new Size(75, 0);

            const badgeRow = lineInfoStack.addStack();
            badgeRow.centerAlignContent();

            const badgeStack = badgeRow.addStack();
            badgeStack.size = new Size(50, 0);
            badgeStack.centerAlignContent();
            badgeStack.setPadding(2, 2, 2, 2);
            badgeStack.backgroundColor = getBadgeBackgroundColor(departure);
            badgeStack.cornerRadius = 4;
            const lineText = badgeStack.addText(departure.route.short_name);
            lineText.font = Font.boldSystemFont(12);
            lineText.textColor = Color.white();
            badgeRow.addSpacer(14);
            
            const platformCode = departure.stop.platform_code || '';
            if (platformCode) {
                const platformText = badgeRow.addText(platformCode);
                platformText.font = Font.boldSystemFont(12);
                platformText.textColor = COLORS.textPrimary;
            }

            lineInfoStack.addSpacer(2);
            const stopData = stopDataMap[departure.stop.id];
            if (stopData && stopData.name) {
                const stopInfoText = lineInfoStack.addText(stopData.name);
                stopInfoText.font = Font.systemFont(10);
                stopInfoText.textColor = COLORS.textSecondary;
                stopInfoText.lineLimit = 1;
            }

            const divider = rowStack.addStack();
            divider.backgroundColor = COLORS.imminent;
            divider.size = new Size(2, 35);
            divider.cornerRadius = 1;

            const destinationStack = rowStack.addStack();
            destinationStack.layoutVertically();

            const headsignText = destinationStack.addText(departure.trip.headsign);
            headsignText.font = Font.boldSystemFont(13);
            headsignText.textColor = COLORS.textPrimary;
            headsignText.lineLimit = 1;

            const scheduled = departure.departure_timestamp.scheduled ? new Date(departure.departure_timestamp.scheduled) : null;
            const predicted = departure.departure_timestamp.predicted ? new Date(departure.departure_timestamp.predicted) : scheduled;
            
            let isDelayed = false;
            if (scheduled && predicted) {
                const delaySeconds = (predicted - scheduled) / 1000;
                isDelayed = delaySeconds > 59;
            }

            const indicatorsStack = destinationStack.addStack();
            indicatorsStack.layoutHorizontally();
            indicatorsStack.centerAlignContent();
            let hasIndicator = false;
            
            // --- NEW FEATURE: Wheelchair Accessibility Indicator ---
            if (departure.trip.is_wheelchair_accessible) {
                const wheelchairText = indicatorsStack.addText("♿︎");
                wheelchairText.font = Font.systemFont(16);
                wheelchairText.textColor = COLORS.wheelchairBlue;
                hasIndicator = true;
            }
            // --- END OF NEW FEATURE ---

            if (departure.trip.is_air_conditioned) {
                if (hasIndicator) indicatorsStack.addSpacer(4);
                const acText = indicatorsStack.addText("❄︎");
                acText.font = Font.systemFont(12);
                acText.textColor = COLORS.acBlue;
                hasIndicator = true;
            }
            
            if (isDelayed) {
                if (hasIndicator) indicatorsStack.addSpacer(4);
                const delayedText = indicatorsStack.addText("Delayed");
                delayedText.font = Font.systemFont(10);
                delayedText.textColor = COLORS.delayed;
                hasIndicator = true;
            }

            if (SHOW_NEXT_ARRIVAL_INFO) {
                const key = `${departure.route.short_name}|${departure.stop.id}`;
                const arrivalTimes = timetable[key] || [];
                const currentIndex = arrivalTimes.findIndex(t => t.time.getTime() === arrivalTime.getTime());

                if (currentIndex > -1 && currentIndex < arrivalTimes.length - 1) {
                    const nextArrival = arrivalTimes[currentIndex + 1];
                    const nextArrivalTime = nextArrival.time;
                    const nextIsAC = nextArrival.isAC;

                    const isNextDepartureVisible = sortedDepartures.some(dep =>
                        new Date(dep.departure_timestamp.predicted).getTime() === nextArrivalTime.getTime() &&
                        dep.route.short_name === departure.route.short_name &&
                        dep.stop.id === departure.stop.id
                    );

                    if (!isNextDepartureVisible) {
                        const nextMinutesUntil = Math.floor((nextArrivalTime - now) / (1000 * 60));
                        let nextArrivalDisplayString;

                        if (nextMinutesUntil > 10) {
                            const hours = nextArrivalTime.getHours().toString().padStart(2, '0');
                            const minutes = nextArrivalTime.getMinutes().toString().padStart(2, '0');
                            nextArrivalDisplayString = `➜ ${hours}:${minutes}`;
                        } else {
                            nextArrivalDisplayString = `➜ ${nextMinutesUntil} min`;
                        }

                        if (nextIsAC) {
                            nextArrivalDisplayString += " ❄︎";
                        }

                        if (hasIndicator) indicatorsStack.addSpacer(4);
                        const nextText = indicatorsStack.addText(nextArrivalDisplayString);
                        nextText.font = Font.systemFont(10);
                        nextText.textColor = COLORS.textSecondary;
                    }
                }
            }

            rowStack.addSpacer();
            const timeStack = rowStack.addStack();
            let timeColor;
            if (minutesUntil <= 2) { timeColor = COLORS.imminent; }
            else if (isDelayed) { timeColor = COLORS.delayed; }
            else { timeColor = COLORS.onTime; }

            const timeLabel = timeStack.addText(`${minutesUntil}`);
            timeLabel.font = Font.boldSystemFont(16);
            timeLabel.textColor = timeColor;
            timeLabel.rightAlignText();

            widget.addSpacer(4);
        });
    }

    widget.addSpacer();
    const lastUpdatedText = widget.addText(`v${WIDGET_VERSION} | Last updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
    lastUpdatedText.font = Font.systemFont(8);
    lastUpdatedText.textColor = COLORS.textSecondary;
    lastUpdatedText.textOpacity = 0.7;
    lastUpdatedText.rightAlignText();
    return widget;
}

// --- UTILITY FUNCTIONS ---
async function loadImage(url) {
    const req = new Request(url);
    return await req.loadImage();
}

function createErrorWidget(title, message) {
    const widget = new ListWidget();
    widget.backgroundColor = COLORS.background;
    widget.setPadding(16, 16, 16, 16);
    const titleText = widget.addText(title);
    titleText.textColor = COLORS.imminent;
    titleText.font = Font.boldSystemFont(16);
    widget.addSpacer(4);
    const messageText = widget.addText(message);
    messageText.textColor = COLORS.textSecondary;
    messageText.font = Font.systemFont(14);
    return widget;
}
