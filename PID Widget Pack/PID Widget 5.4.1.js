// --- COMMON CONFIGURATION ---
let API_KEY = "YOUR_API_KEY";
if (Keychain.contains("PID_API_KEY")) {
  API_KEY = Keychain.get("PID_API_KEY");
}

const LOGO_URL = 'https://raw.githubusercontent.com/alanmakareem/pid-timetable-widget/refs/heads/main/vizualni_podoba_01-scaled.png';
const USE_MOCK_DATA = false; // Set to true to use mock data for testing both widgets

// --- COMMON COLORS (Dynamically adapt to light/dark mode) ---
// Visual Parameter: Kept as is from your file
const BACKGROUND = Color.dynamic(new Color("#FFFFFF"), new Color("#1C1C1E"));
const TEXT_BLACK = Color.dynamic(new Color("#000000"), new Color("#FFFFFF"));
const RED_TIME = Color.dynamic(new Color("#E53E3E"), new Color("#FF453A"));
const ORANGE_TIME = Color.dynamic(new Color("#FFA500"), new Color("#FFB340"));
const GREEN_TIME = Color.dynamic(new Color("#34C759"), new Color("#30D158"));
const GRAY_TEXT = Color.dynamic(new Color("#8E8E93"), new Color("#CCCCCC"));
const AC_BLUE = Color.dynamic(new Color("#007AFF"), new Color("#5AC8FA"));
const PID_BLUE_LARGE = new Color("#005C9E");

// --- CONFIGURATION FOR STOP IDs ---
// --- LARGE WIDGET CONFIGURATION ---
// Visual Parameter Context: These values determine data, not direct visual styling of elements.
const STOP_ASW_IDS_LARGE = []; // From your file
const STOP_CIS_IDS_LARGE = ['56793']; // From your file
const MAX_DEPARTURES_TO_SHOW_LARGE = 10; // From your file

// --- MEDIUM WIDGET CONFIGURATION ---
// Visual Parameter Context: These values determine data.
const STOP_ASW_IDS_MEDIUM = ['U337Z3P', null]; // From your file (null is handled by filter)
const STOP_CIS_IDS_MEDIUM = ['28003', '27883']; // From your file
const DEPARTURES_PER_STOP_MEDIUM = 6; // From your file

// --- Constant for UI calculation (Improved for readability) ---
const APPROX_ROW_TOTAL_HEIGHT_LARGE = 26 + 4; // row height + bottom spacer from your large widget layout

// ==========================================================================================
// --- INTERNAL HELPER FUNCTION FOR FETCHING AND PARSING DEPARTURES ---
// ==========================================================================================
async function _fetchAndParseDepartures(apiUrl, idTypeForLog, stopNameOnError = "Error Loading") {
    const req = new Request(apiUrl);
    req.headers = { 'x-access-token': API_KEY };

    try {
        console.log(`Attempting to fetch from: ${apiUrl} (using ${idTypeForLog})`);
        const data = await req.loadJSON();

        let stopName = stopNameOnError; // Default stop name
        // Corrected Logic: Determine stopName if possible, but don't gate departure processing on it.
        if (data && data.stops && data.stops.length > 0) {
            stopName = data.stops[0].stop_name;
        }

        // Corrected Logic: Process departures if they exist, independently of data.stops
        if (data && data.departures && data.departures.length > 0) {
            const mapped = (data.departures || []).map(dep => {
                const scheduled = dep.departure_timestamp.scheduled ? new Date(dep.departure_timestamp.scheduled) : null;
                const predicted = dep.departure_timestamp.predicted ? new Date(dep.departure_timestamp.predicted) : scheduled;
                if (!scheduled) return null;
                const delaySeconds = (predicted - scheduled) / 1000;
                const isDelayed = delaySeconds > 59;
                const airConditioned = dep.trip && dep.trip.is_air_conditioned === true;
                return {
                    line: dep.route ? dep.route.short_name : 'N/A',
                    headsign: dep.trip ? dep.trip.headsign : 'N/A',
                    scheduled: scheduled,
                    predicted: predicted,
                    arrival: predicted,
                    isDelayed: isDelayed,
                    delayInSeconds: delaySeconds > 0 ? Math.round(delaySeconds) : 0,
                    airConditioned: airConditioned
                };
            }).filter(dep => dep !== null && dep.arrival && !isNaN(dep.arrival.getTime()));

            const now = new Date();
            const futureDates = mapped.filter(dep => (dep.arrival - now) > -30000);
            futureDates.sort((a, b) => a.arrival - b.arrival);

            if (futureDates.length > 0) {
                console.log(`Successfully fetched and parsed ${futureDates.length} departures using ${idTypeForLog} IDs for stop: ${stopName}`);
                return { departures: futureDates, stopName: stopName, success: true };
            } else {
                console.log(`No *future* departures found using ${idTypeForLog} IDs for stop: ${stopName} (Raw departures: ${mapped.length})`);
                // Return the determined stopName even if no future departures
                return { departures: [], stopName: stopName, success: false, noFutureDepartures: true };
            }
        } else { // No data.departures or empty array
            console.log(`No departures array or empty departures in response using ${idTypeForLog} IDs. Data: ${JSON.stringify(data).substring(0,200)}`);
            // Return the determined stopName (could be from data.stops or the default onError name)
            return { departures: [], stopName: stopName, success: false };
        }
    } catch (e) {
        console.error(`API Error using ${idTypeForLog} IDs from ${apiUrl}: ${e}`);
        return { departures: [], stopName: stopNameOnError, success: false, error: e.toString() };
    }
}

// ==========================================================================================
// --- LARGE WIDGET FUNCTIONS ---
// Moved to top level for correct scope
// ==========================================================================================
async function fetchDeparturesForLargeWidget(aswIds, cisIds) {
    if (USE_MOCK_DATA) {
        const now = new Date();
        const mockDeparturesBase = [
            { line: "M213", headsign: "Želivského (Mock)", scheduled: new Date(now.getTime() + 60000), predicted: new Date(now.getTime() + 60000), arrival: new Date(now.getTime() + 60000), isDelayed: false, delayInSeconds: 0, airConditioned: true },
            { line: "M136", headsign: "S. Čakovice (Mock)", scheduled: new Date(now.getTime() + 120000), predicted: new Date(now.getTime() + 180000), arrival: new Date(now.getTime() + 180000), isDelayed: true, delayInSeconds: 60, airConditioned: false },
        ];
        let fullMockDepartures = [];
        for (let i = 0; i < MAX_DEPARTURES_TO_SHOW_LARGE; i++) {
            const baseDep = mockDeparturesBase[i % mockDeparturesBase.length];
            fullMockDepartures.push({...baseDep, arrival: new Date(now.getTime() + (i + 1) * 2 * 60000), headsign: `${baseDep.headsign} #${i+1}` });
        }
        // Corrected: return statement moved outside the loop
        return { departures: fullMockDepartures, stopName: "Mock Large Widget", success: true };
    }

    let result = { success: false, departures: [], stopName: "Error Large Widget" };
    const validAswIds = aswIds ? aswIds.filter(id => id && id.trim() !== '') : [];
    const validCisIds = cisIds ? cisIds.filter(id => id && id.trim() !== '') : [];

    if (validAswIds.length > 0) {
        const aswIdParams = validAswIds.map(id => `ids[]=${encodeURIComponent(id)}`).join('&');
        const aswUrl = `https://api.golemio.cz/v2/pid/departureboards?${aswIdParams}&limit=20&minutesAfter=120`;
        result = await _fetchAndParseDepartures(aswUrl, "ASW (Large)");
    }

    if (!result.success || result.departures.length === 0) {
        if (validCisIds.length > 0) {
            console.log("ASW IDs failed or yielded no data for Large Widget, trying CIS IDs.");
            const cisIdParams = validCisIds.map(id => `cisIds[]=${encodeURIComponent(id)}`).join('&');
            const cisUrl = `https://api.golemio.cz/v2/pid/departureboards?${cisIdParams}&limit=20&minutesAfter=120`;
            const cisResult = await _fetchAndParseDepartures(cisUrl, "CIS (Large)");
            if (cisResult.success || !result.success ) {
                result = cisResult;
            } else if (result.success && result.departures.length === 0 && cisResult.noFutureDepartures) {
                // Removed: result.stopName = result.stopName; (redundant)
            }
        } else {
            if (!result.success) console.log("No valid CIS IDs provided for Large Widget fallback.");
        }
    }

    // Improved User-Facing Error Messages for UI
    if (!result.success && result.error) result.stopName = "API Error";
    else if (result.departures.length === 0 && !result.noFutureDepartures && result.stopName === "Error Large Widget") result.stopName = "No Stops Defined";
    else if (result.departures.length === 0 && result.noFutureDepartures && result.stopName === "Error Large Widget") result.stopName = "No Data"; // More generic if stop name wasn't resolved

    return result;
}

function addDepartureRowLargeWidget(widget, departure) {
    // Visual Parameters: Kept as is from your file
    const rowStack = widget.addStack();
    rowStack.layoutHorizontally();
    rowStack.centerAlignContent();
    rowStack.spacing = 10;
    rowStack.size = new Size(0, 20);

    const lineStack = rowStack.addStack();
    lineStack.backgroundColor = PID_BLUE_LARGE;
    lineStack.cornerRadius = 4;
    lineStack.setPadding(3, 5, 3, 5);
    lineStack.size = new Size(50, 0);
    const lineText = lineStack.addText(String(departure.line));
    lineText.font = Font.boldSystemFont(12);
    lineText.textColor = new Color("#FFFFFF");
    lineText.centerAlignText();

    const directionStack = rowStack.addStack();
    directionStack.layoutHorizontally();
    directionStack.centerAlignContent();
    const directionText = directionStack.addText(String(departure.headsign));
    directionText.font = Font.boldSystemFont(12);
    directionText.textColor = TEXT_BLACK;
    directionText.lineLimit = 1;
    directionText.minimumScaleFactor = 0.8;

    if (departure.airConditioned) {
        const acText = directionStack.addText(" ❄︎");
        acText.font = Font.boldSystemFont(14);
        acText.textColor = AC_BLUE;
    }

    rowStack.addSpacer();

    const timeStack = rowStack.addStack();
    timeStack.layoutHorizontally();
    timeStack.centerAlignContent();
    const now_time = new Date();
    const arrival = departure.arrival;

    if (!arrival || isNaN(arrival.getTime())) {
        const timeLabel = timeStack.addText("?? min");
        timeLabel.font = Font.boldSystemFont(12);
        timeLabel.textColor = GRAY_TEXT;
        return;
    }

    const secs_remaining = (arrival - now_time) / 1000;
    let timeColor, timeText, showDot = false;

    if (departure.isDelayed) {
        timeColor = ORANGE_TIME;
        showDot = true;
        if (secs_remaining <= 10) { timeText = "Now"; }
        else if (secs_remaining < 60) { timeText = "< 1 min"; }
        else { timeText = `${Math.floor(secs_remaining / 60)} min`; }
    } else {
        if (secs_remaining <= 10) { timeColor = RED_TIME; timeText = "Now"; }
        else if (secs_remaining < 60) { timeColor = RED_TIME; timeText = "< 1 min"; }
        else {
            timeText = `${Math.floor(secs_remaining / 60)} min`;
            timeColor = GREEN_TIME;
        }
    }

    if (showDot) {
        const dot = timeStack.addText("● ");
        dot.textColor = timeColor;
        dot.font = Font.boldSystemFont(8);
    }
    const timeLabel = timeStack.addText(timeText);
    timeLabel.font = Font.boldSystemFont(14);
    timeLabel.textColor = timeColor;
}

async function createLayoutLargeWidget(widget, departuresData) {
    const { departures, stopName } = departuresData;
    // Visual Parameters: Kept as is from your file
    widget.backgroundColor = BACKGROUND;
    widget.setPadding(15, 15, 15, 15);

    const headerStack = widget.addStack();
    headerStack.layoutHorizontally();
    headerStack.centerAlignContent();
    try {
        const logoReq = new Request(LOGO_URL);
        const logoImg = await logoReq.loadImage();
        const logo = headerStack.addImage(logoImg);
        logo.imageSize = new Size(50, 35);
        logo.cornerRadius = 4;
    } catch (e) {
        const logoText = headerStack.addText("PID");
        logoText.font = Font.boldSystemFont(14);
        logoText.textColor = PID_BLUE_LARGE;
    }

    headerStack.addSpacer(); // move stop name to right
    const stopNameText = headerStack.addText(stopName || "Loading...");
    stopNameText.font = Font.boldSystemFont(24);
    stopNameText.lineLimit = 1;
    stopNameText.textColor = TEXT_BLACK;
    stopNameText.minimumScaleFactor = 0.7;
    widget.addSpacer(12);

    const departureCountToShow = Math.min(MAX_DEPARTURES_TO_SHOW_LARGE, departures ? departures.length : 0);
    if (departureCountToShow === 0) {
        const noBusText = widget.addText(departuresData.success && departuresData.noFutureDepartures ? "No future departures." : (departuresData.success ? "No departures available." : (stopName === "API Error" ? "API Error" : "Could not load departures.")));
        noBusText.font = Font.systemFont(14);
        noBusText.textColor = GRAY_TEXT;
        noBusText.centerAlignText();
    } else {
        for (let i = 0; i < departureCountToShow; i++) {
            addDepartureRowLargeWidget(widget, departures[i]);
            if (i < departureCountToShow - 1) widget.addSpacer(4);
        }
    }

    for (let i = departureCountToShow; i < MAX_DEPARTURES_TO_SHOW_LARGE; i++) {
        widget.addSpacer(8 + APPROX_ROW_TOTAL_HEIGHT_LARGE); // Used constant for clarity
    }

    widget.addSpacer();
    const divider = widget.addStack();
    divider.addSpacer();
    const ctx = new DrawContext();
    ctx.size = new Size(500, 4);
    ctx.opaque = false;
    ctx.setFillColor(RED_TIME);
    ctx.fillRect(new Rect(0, 0, ctx.size.width, 3));
    divider.addImage(ctx.getImage());
    divider.addSpacer();
    widget.addSpacer();

    const bottomStack = widget.addStack();
    bottomStack.layoutHorizontally();
    bottomStack.centerAlignContent();
    const legendStack = bottomStack.addStack();
    legendStack.layoutHorizontally();
    const dot = legendStack.addText("●");
    dot.textColor = ORANGE_TIME;
    dot.font = Font.mediumSystemFont(10);
    const labelText = legendStack.addText(" Delayed ");
    labelText.font = Font.systemFont(10);
    labelText.textColor = GRAY_TEXT;
    bottomStack.addSpacer();
    const now_footer = new Date();
    const timeStr = `${now_footer.getHours().toString().padStart(2, '0')}:${now_footer.getMinutes().toString().padStart(2, '0')}`;
    const updateText = bottomStack.addText(`Updated: ${timeStr}`);
    updateText.font = Font.systemFont(10);
    updateText.textColor = GRAY_TEXT;
    updateText.textOpacity = 0.8;
    updateText.rightAlignText();
}

async function createLargeWidget() {
    const widget = new ListWidget();
    widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
    const departuresData = await fetchDeparturesForLargeWidget(STOP_ASW_IDS_LARGE, STOP_CIS_IDS_LARGE);
    await createLayoutLargeWidget(widget, departuresData);
    return widget;
}

// ==========================================================================================
// --- MEDIUM WIDGET FUNCTIONS ---
// Moved to top level for correct scope
// ==========================================================================================
async function fetchDeparturesForMediumWidgetStop(aswId, cisId, stopIndex) {
    const stopLogErrorSuffix = `(Medium Stop ${stopIndex + 1})`;
    if (USE_MOCK_DATA) {
        const now = new Date();
        let stopNameMock = `Mock Stop ${stopIndex + 1}`;
        let lineStart = (stopIndex === 0) ? 100 : 200;
        return {
            stopName: stopNameMock,
            departures: Array(DEPARTURES_PER_STOP_MEDIUM).fill(null).map((_, i) => ({
                line: `M${lineStart + i * 10}`,
                headsign: `Mock Dest ${String.fromCharCode(65 + i)}`,
                arrival: new Date(now.getTime() + (i + 1) * 3 * 60000),
                isDelayed: i % 2 === 0,
                airConditioned: i % 3 === 0
            })),
            success: true
        };
    }

    let result = { success: false, departures: [], stopName: `Error Stop ${stopIndex + 1}` };
    if (aswId && aswId.trim() !== '') {
        const aswUrl = `https://api.golemio.cz/v2/pid/departureboards?ids[]=${encodeURIComponent(aswId)}&limit=10&minutesAfter=120`;
        result = await _fetchAndParseDepartures(aswUrl, `ASW ${stopLogErrorSuffix}`, `Error ASW ${stopIndex + 1}`);
    }

    if (!result.success || result.departures.length === 0) {
        if (cisId && cisId.trim() !== '') {
            console.log(`ASW ID failed or yielded no data for ${stopLogErrorSuffix}, trying CIS ID.`);
            const cisUrl = `https://api.golemio.cz/v2/pid/departureboards?cisIds[]=${encodeURIComponent(cisId)}&limit=10&minutesAfter=120`;
            const cisResult = await _fetchAndParseDepartures(cisUrl, `CIS ${stopLogErrorSuffix}`, `Error CIS ${stopIndex + 1}`);
            if (cisResult.success || !result.success) {
                result = cisResult;
            } else if (result.success && result.departures.length === 0 && cisResult.noFutureDepartures) {
                // Removed: result.stopName = result.stopName; (redundant)
            }
        } else {
            if (!result.success) console.log(`No valid CIS ID provided for ${stopLogErrorSuffix} fallback.`);
        }
    }

    // Improved User-Facing Error Messages for UI
    if (!result.success && result.error) result.stopName = `Stop ${stopIndex+1} API Error`;
    else if (result.departures.length === 0 && !result.noFutureDepartures && result.stopName.startsWith("Error Stop")) result.stopName = `No ID Stop ${stopIndex+1}`;
    else if (result.departures.length === 0 && result.noFutureDepartures && result.stopName.startsWith("Error Stop")) result.stopName = `Stop ${stopIndex+1} No Data`;


    if (result.success && result.departures) {
        result.departures = result.departures.slice(0, DEPARTURES_PER_STOP_MEDIUM);
    }
    return result;
}

function timeInfoMediumWidget(dep) {
    // Visual Parameters: Kept as is from your file
    const now = new Date();
    const secs = (dep.arrival - now) / 1000;
    let color, text;
    if (dep.isDelayed) {
        color = ORANGE_TIME;
        if (secs <= 10) text = "!!";
        else if (secs < 60) text = "0";
        else text = `${Math.floor(secs / 60)}`;
    } else {
        if (secs <= 10) { color = RED_TIME; text = "!!"; }
        else if (secs < 60) { color = RED_TIME; text = "0"; }
        else { color = GREEN_TIME; text = `${Math.floor(secs / 60)}`; }
    }
    return { color, text };
}

function createDepartureColumnMediumWidget(parentStack, departuresData, stopIndex) {
    const { departures, stopName, success, noFutureDepartures } = departuresData;
    // Visual Parameters: Kept as is from your file
    const column = parentStack.addStack();
    column.layoutVertically();

    if (!departures || departures.length === 0) {
        let message = `No departures for\n${(stopName || `Stop ${stopIndex + 1}`).split(" (")[0]}.`;
        if (success && noFutureDepartures) message = `No future deps for\n${(stopName || `Stop ${stopIndex + 1}`).split(" (")[0]}.`;
        else if (!success && stopName && (stopName.includes("API Error") || stopName.startsWith("Err") || stopName.startsWith("No ID"))) message = `${stopName}`; // Show specific error
        else if (!success) message = `Could not load for\n${(stopName || `Stop ${stopIndex + 1}`).split(" (")[0]}.`;

        const noDepText = column.addText(message);
        noDepText.font = Font.systemFont(10);
        noDepText.textColor = GRAY_TEXT;
        noDepText.centerAlignText();
        column.addSpacer();
        return column;
    }

    for (const dep of departures) {
        const row = column.addStack();
        row.layoutHorizontally();
        row.centerAlignContent();
        row.spacing = 1; // Visual Parameter: Kept as 1 from your file

        const lineStack = row.addStack();
        lineStack.size = new Size(35, 0);
        lineStack.layoutHorizontally();
        const lineText = lineStack.addText(dep.line);
        lineText.font = Font.boldSystemFont(12);
        lineText.textColor = TEXT_BLACK;
        lineStack.addSpacer(2); // Visual Parameter: Kept as 2 from your file

        const dirStack = row.addStack();
        dirStack.size = new Size(70, 0);
        dirStack.layoutHorizontally();
        const dirText = dirStack.addText(dep.headsign);
        dirText.font = Font.systemFont(14);
        dirText.textColor = TEXT_BLACK;
        dirText.lineLimit = 1;
        dirText.minimumScaleFactor = 0.8;
        dirStack.addSpacer(); // Visual Parameter: Kept as flexible spacer (no arg) from your file

        row.addSpacer();

        const acTimeStack = row.addStack();
        acTimeStack.layoutHorizontally();
        acTimeStack.centerAlignContent();
        if (dep.airConditioned) {
            const acText = acTimeStack.addText("❄︎");
            acText.font = Font.systemFont(10);
            acText.textColor = AC_BLUE;
            acTimeStack.addSpacer(2); // Visual Parameter: Kept as 2 from your file
        }
        const { color, text: timeValue } = timeInfoMediumWidget(dep);
        const timeText = acTimeStack.addText(timeValue);
        timeText.font = Font.boldSystemFont(12);
        timeText.textColor = color;
        column.addSpacer(2); // Visual Parameter: Kept as 2 from your file
    }
    return column;
}

async function createMediumWidget() {
    // Visual Parameters: Kept as is from your file
    const widget = new ListWidget();
    widget.backgroundColor = BACKGROUND;
    widget.setPadding(20, 15, 15, 15);
    widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

    // Improved: Slice before map to avoid unnecessary processing if STOP_ASW_IDS_MEDIUM has >2 elements
    const stopDataPromises = STOP_ASW_IDS_MEDIUM.slice(0, 2).map((aswId, index) => {
        const cisId = (STOP_CIS_IDS_MEDIUM[index] || ''); // Fallback to empty if CIS array is shorter or element is undefined
        return fetchDeparturesForMediumWidgetStop(aswId || '', cisId, index);
    });

    const fetchedStopData = await Promise.all(stopDataPromises);
    const stopAData = fetchedStopData[0] || { departures: [], stopName: "Stop 1 N/A", success: false };
    const stopBData = fetchedStopData[1] || { departures: [], stopName: "Stop 2 N/A", success: false };

    // Visual Parameters below are kept as is from your file
    const headerStack = widget.addStack();
    headerStack.layoutHorizontally();
    headerStack.centerAlignContent();
    const stopNameContainerWidth = 105;

    const stopAOuterContainer = headerStack.addStack();
    stopAOuterContainer.size = new Size(stopNameContainerWidth, 0);
    stopAOuterContainer.layoutVertically();
    const stopAText = stopAOuterContainer.addText(stopAData.stopName);
    stopAText.font = Font.boldSystemFont(12);
    stopAText.textColor = TEXT_BLACK;
    stopAText.lineLimit = 2;
    stopAText.minimumScaleFactor = 0.7;
    stopAText.leftAlignText();
    headerStack.addSpacer();

    try {
        const logoReq = new Request(LOGO_URL);
        const logoImg = await logoReq.loadImage();
        const logo = headerStack.addImage(logoImg);
        logo.imageSize = new Size(36, 24);
        logo.cornerRadius = 3;
        logo.centerAlignImage();
    } catch (e) {
        const logoTextFallback = headerStack.addText("PID");
        logoTextFallback.font = Font.boldSystemFont(14);
        logoTextFallback.textColor = AC_BLUE;
        logoTextFallback.centerAlignText();
    }
    headerStack.addSpacer();

    const stopBOuterContainer = headerStack.addStack();
    stopBOuterContainer.size = new Size(stopNameContainerWidth, 0);
    stopBOuterContainer.layoutVertically();
    const stopBInnerStack = stopBOuterContainer.addStack();
    stopBInnerStack.layoutHorizontally();
    stopBInnerStack.addSpacer();
    const stopBText = stopBInnerStack.addText(stopBData.stopName);
    stopBText.font = Font.boldSystemFont(12);
    stopBText.textColor = TEXT_BLACK;
    stopBText.lineLimit = 2;
    stopBText.minimumScaleFactor = 0.7;

    widget.addSpacer(6);

    const mainStack = widget.addStack();
    mainStack.layoutHorizontally();
    mainStack.topAlignContent();
    createDepartureColumnMediumWidget(mainStack, stopAData, 0);
    mainStack.addSpacer(6);
    const divider = mainStack.addStack();
    divider.size = new Size(2, 95);
    divider.backgroundColor = RED_TIME;
    mainStack.addSpacer(6);
    createDepartureColumnMediumWidget(mainStack, stopBData, 1);
    widget.addSpacer();

    const bottomStack = widget.addStack();
    bottomStack.layoutHorizontally();
    bottomStack.addSpacer();
    const now_footer = new Date();
    const timeStr = `${now_footer.getHours().toString().padStart(2, '0')}:${now_footer.getMinutes().toString().padStart(2, '0')}`;
    const updateText = bottomStack.addText(`Updated: ${timeStr}`);
    updateText.font = Font.systemFont(8);
    updateText.textColor = GRAY_TEXT;
    updateText.textOpacity = 0.8;
    bottomStack.addSpacer();
    return widget;
}

// ==========================================================================================
// --- MAIN SCRIPT EXECUTION LOGIC ---
// ==========================================================================================
async function run() {
    let widgetToPresent;

    if (config.widgetFamily === 'large') {
        widgetToPresent = await createLargeWidget();
    } else if (config.widgetFamily === 'medium') {
        widgetToPresent = await createMediumWidget();
    } else {
        widgetToPresent = new ListWidget();
        const text = widgetToPresent.addText("Configure widget size (Large or Medium).");
        text.font = Font.systemFont(12);
        text.centerAlignText();
    }

    if (config.runsInWidget) {
        Script.setWidget(widgetToPresent);
    } else {
        // In-app presentation
        if (widgetToPresent && widgetToPresent.allTexts && widgetToPresent.allTexts.length > 0 && widgetToPresent.allTexts[0].text.includes("Configure widget size")) {
            await widgetToPresent.presentSmall();
        } else if (widgetToPresent) {
            // Attempt to present appropriately; defaults to medium if specific test widget wasn't explicitly large.
            // Simplified presentation for in-app based on what `widgetToPresent` is
            try {
                if (widgetToPresent.allStacks.some(s => s.size && s.size.width === 500)) { // Heuristic for large widget's divider
                    await widgetToPresent.presentLarge();
                } else {
                    await widgetToPresent.presentMedium();
                }
            } catch (e) {
                console.warn("Could not determine best in-app presentation size, defaulting to small/medium. Error: " + e);
                await widgetToPresent.presentSmall(); // Fallback
            }
        } else {
            // Fallback if widgetToPresent is undefined
            let fallbackWidget = new ListWidget();
            fallbackWidget.addText("Error: Widget not created.");
            await fallbackWidget.presentSmall();
        }
    }
    Script.complete();
}

// --- ERROR HANDLING ---
run().catch(err => {
    console.error(`Unhandled Script Error: ${err}\nStack: ${err.stack}`);
    if (config.runsInWidget) {
        let errorWidget = new ListWidget();
        // User-friendly error in widget
        errorWidget.addText("Widget Error");
        errorWidget.addText("Check Scriptable logs.");
        errorWidget.textColor = Color.dynamic(Color.black(), Color.white());
        errorWidget.backgroundColor = Color.dynamic(new Color("#FFD2D2"), new Color("#580000")); // Light/Dark Red
        Script.setWidget(errorWidget);
    } else {
        let errorWidget = new ListWidget();
        errorWidget.addText(`Script Error: ${err}`);
        errorWidget.presentSmall();
    }
    Script.complete();
});
