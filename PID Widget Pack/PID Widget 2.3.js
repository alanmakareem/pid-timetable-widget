// --- COMMON CONFIGURATION ---
const API_KEY = // get your API key from https://golemio.cz/api
const LOGO_URL = 'https://raw.githubusercontent.com/alanmakareem/pid-timetable-widget/refs/heads/main/vizualni_podoba_01-scaled.png';
const USE_MOCK_DATA = false; // Set to true to use mock data for testing both widgets

// --- COMMON COLORS (Dynamically adapt to light/dark mode) ---
const BACKGROUND = Color.dynamic(new Color("#FFFFFF"), new Color("#1C1C1E"));
const TEXT_BLACK = Color.dynamic(new Color("#000000"), new Color("#FFFFFF"));
const RED_TIME = Color.dynamic(new Color("#E53E3E"), new Color("#FF453A"));
const ORANGE_TIME = Color.dynamic(new Color("#FFA500"), new Color("#FFB340"));
const GREEN_TIME = Color.dynamic(new Color("#34C759"), new Color("#30D158"));
const GRAY_TEXT = Color.dynamic(new Color("#8E8E93"), new Color("#CCCCCC"));
const AC_BLUE = Color.dynamic(new Color("#007AFF"), new Color("#5AC8FA"));
const PID_BLUE_LARGE = new Color("#005C9E");

// --- CONFIGURATION FOR STOP IDs ---
// !! IMPORTANT !!
// - Fill in ASW IDs and CIS IDs for your desired stops.
// - ASW IDs will be tried first. If they fail or are not provided, CIS IDs will be used.
// - For MEDIUM widget: STOP_ASW_IDS_MEDIUM[i] and STOP_CIS_IDS_MEDIUM[i] should correspond to the same stop.
//   If one type of ID is not available for a stop, leave its entry as an empty string (e.g., '').

// --- LARGE WIDGET CONFIGURATION ---
const STOP_ASW_IDS_LARGE = ['U424Z2P']; // Example ASW IDs (e.g., Golemio 'id'). Add more as needed.
const STOP_CIS_IDS_LARGE = ['56793']; // Example CIS IDs (e.g., Golemio 'cis_id'). Must correspond if ASW is empty for a conceptual "stop".
const MAX_DEPARTURES_TO_SHOW_LARGE = 8;

// --- MEDIUM WIDGET CONFIGURATION ---
const STOP_ASW_IDS_MEDIUM = ['U424Z2P', 'U1040Z4P']; // Example ASW IDs for 2 stops.
const STOP_CIS_IDS_MEDIUM = ['56793', '58759']; // Example CIS IDs for 2 stops. Ensure these arrays have the same number of elements.
const DEPARTURES_PER_STOP_MEDIUM = 6;


// ========================================================================
// --- INTERNAL HELPER FUNCTION FOR FETCHING AND PARSING DEPARTURES ---
// ========================================================================
async function _fetchAndParseDepartures(apiUrl, idTypeForLog, stopNameOnError = "Error Loading") {
    const req = new Request(apiUrl);
    req.headers = { 'x-access-token': API_KEY };
    try {
        console.log(`Attempting to fetch from: ${apiUrl} (using ${idTypeForLog})`);
        const data = await req.loadJSON();
        
        if (data && data.departures && data.departures.length > 0) {
            let stopName = "Unknown Stop";
            if (data.stops && data.stops.length > 0) {
                // For multiple IDs, Golemio might list multiple stops. We'll use the first one's name.
                // Or, if specific logic is needed to combine names, it can be added here.
                stopName = data.stops[0].stop_name;
            }

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
                return { departures: [], stopName: stopName || "No Departures", success: false, noFutureDepartures: true };
            }
        } else {
            console.log(`No departures array or empty departures in response using ${idTypeForLog} IDs. Data: ${JSON.stringify(data).substring(0,200)}`);
            return { departures: [], stopName: (data.stops && data.stops.length > 0 ? data.stops[0].stop_name : stopNameOnError), success: false };
        }
    } catch (e) {
        console.error(`API Error using ${idTypeForLog} IDs from ${apiUrl}: ${e}`);
        return { departures: [], stopName: stopNameOnError, success: false, error: e.toString() };
    }
}

// =============================
// --- LARGE WIDGET CODE ---
// =============================
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
        return { departures: fullMockDepartures, stopName: "Mock Large Widget", success: true };
    }

    let result = { success: false, departures: [], stopName: "Error Large Widget" };
    const validAswIds = aswIds ? aswIds.filter(id => id && id.trim() !== '') : [];
    const validCisIds = cisIds ? cisIds.filter(id => id && id.trim() !== '') : [];

    // Try ASW IDs first
    if (validAswIds.length > 0) {
        const aswIdParams = validAswIds.map(id => `ids[]=${encodeURIComponent(id)}`).join('&');
        const aswUrl = `https://api.golemio.cz/v2/pid/departureboards?${aswIdParams}&limit=20&minutesAfter=120`;
        result = await _fetchAndParseDepartures(aswUrl, "ASW (Large)");
    }

    // If ASW IDs failed or returned no departures, try CIS IDs
    if (!result.success || result.departures.length === 0) {
        if (validCisIds.length > 0) {
            console.log("ASW IDs failed or yielded no data for Large Widget, trying CIS IDs.");
            const cisIdParams = validCisIds.map(id => `cisIds[]=${encodeURIComponent(id)}`).join('&');
            const cisUrl = `https://api.golemio.cz/v2/pid/departureboards?${cisIdParams}&limit=20&minutesAfter=120`;
            const cisResult = await _fetchAndParseDepartures(cisUrl, "CIS (Large)");
            // Only override if CIS was successful or ASW had an error (not just no departures)
            if (cisResult.success || !result.success ) { // if cisResult got data, or if original result was a hard fail
                 result = cisResult;
            } else if (result.success && result.departures.length === 0 && cisResult.noFutureDepartures) {
                // If ASW was success but no future departures, and CIS also no future departures, stick with ASW stop name
                result.stopName = result.stopName; // Keep ASW stop name
            }

        } else {
             if (!result.success) console.log("No valid CIS IDs provided for Large Widget fallback.");
        }
    }
    
    if (!result.success && result.error) result.stopName = `Error: ${result.error.substring(0,20)}`;
    else if (result.departures.length === 0 && !result.noFutureDepartures) result.stopName = result.stopName === "Error Large Widget" ? "No Stops Defined" : result.stopName; // If it resolved to a name but no data.
    else if (result.departures.length === 0 && result.noFutureDepartures) result.stopName = `${result.stopName}`; //Keep stop name, no future departures will be shown

    return result;
}

function addDepartureRowLargeWidget(widget, departure) {
 
    const rowStack = widget.addStack();
    rowStack.layoutHorizontally();
    rowStack.centerAlignContent();
    rowStack.spacing = 16;
    rowStack.size = new Size(0, 26);

    const lineStack = rowStack.addStack();
    lineStack.backgroundColor = PID_BLUE_LARGE;
    lineStack.cornerRadius = 4;
    lineStack.setPadding(3, 5, 3, 5);
    lineStack.size = new Size(50, 0);
    const lineText = lineStack.addText(String(departure.line));
    lineText.font = Font.boldSystemFont(14);
    lineText.textColor = new Color("#FFFFFF");
    lineText.centerAlignText();

    const directionStack = rowStack.addStack();
    directionStack.layoutHorizontally();
    directionStack.centerAlignContent(); 
    const directionText = directionStack.addText(String(departure.headsign));
    directionText.font = Font.boldSystemFont(14);
    directionText.textColor = TEXT_BLACK;
    directionText.lineLimit = 1;
    directionText.minimumScaleFactor = 0.8;

    if (departure.airConditioned) {
        const acText = directionStack.addText(" ❄︎"); 
        acText.font = Font.boldSystemFont(16);
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
        timeLabel.font = Font.boldSystemFont(14);
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
        logoText.font = Font.boldSystemFont(16);
        logoText.textColor = PID_BLUE_LARGE;
    }

    headerStack.addSpacer(16);
    const stopNameText = headerStack.addText(stopName || "Loading...");
    stopNameText.font = Font.boldSystemFont(28);
    stopNameText.lineLimit = 1;
    stopNameText.textColor = TEXT_BLACK;
    stopNameText.minimumScaleFactor = 0.7;
    widget.addSpacer(12);

    const departureCountToShow = Math.min(MAX_DEPARTURES_TO_SHOW_LARGE, departures ? departures.length : 0);
    if (departureCountToShow === 0) {
        const noBusText = widget.addText(departuresData.success && departuresData.noFutureDepartures ? "No future departures." : (departuresData.success ? "No departures available." : "Could not load departures."));
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
        widget.addSpacer(8 + 26 + 4);
    }


    widget.addSpacer(); // Dynamic spacer before footer
    const divider = widget.addStack();
    divider.addSpacer(); // Center the line
    const ctx = new DrawContext();
    ctx.size = new Size(500, 4);
    ctx.opaque = false;
    ctx.setFillColor(RED_TIME);
    ctx.fillRect(new Rect(0, 0, ctx.size.width, 3));
    divider.addImage(ctx.getImage());
    divider.addSpacer(); // Center the line
    widget.addSpacer(); // Space after divider

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

// ===============================
// --- MEDIUM WIDGET CODE ---
// ===============================
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

    // Try ASW ID first
    if (aswId && aswId.trim() !== '') {
        const aswUrl = `https://api.golemio.cz/v2/pid/departureboards?ids[]=${encodeURIComponent(aswId)}&limit=10&minutesAfter=120`;
        result = await _fetchAndParseDepartures(aswUrl, `ASW ${stopLogErrorSuffix}`, `Error ASW ${stopIndex + 1}`);
    }

    // If ASW ID failed or not provided, or returned no departures, try CIS ID
    if (!result.success || result.departures.length === 0) {
        if (cisId && cisId.trim() !== '') {
            console.log(`ASW ID failed or yielded no data for ${stopLogErrorSuffix}, trying CIS ID.`);
            const cisUrl = `https://api.golemio.cz/v2/pid/departureboards?cisIds[]=${encodeURIComponent(cisId)}&limit=10&minutesAfter=120`;
            const cisResult = await _fetchAndParseDepartures(cisUrl, `CIS ${stopLogErrorSuffix}`, `Error CIS ${stopIndex + 1}`);
             if (cisResult.success || !result.success) {
                 result = cisResult;
            } else if (result.success && result.departures.length === 0 && cisResult.noFutureDepartures) {
                result.stopName = result.stopName; 
            }
        } else {
            if (!result.success) console.log(`No valid CIS ID provided for ${stopLogErrorSuffix} fallback.`);
        }
    }
    
    if (!result.success && result.error) result.stopName = `Err ${stopIndex+1}: ${result.error.substring(0,10)}`;
    else if (result.departures.length === 0 && !result.noFutureDepartures) result.stopName = result.stopName.startsWith("Error Stop") ? `No ID ${stopIndex+1}` : result.stopName;
    else if (result.departures.length === 0 && result.noFutureDepartures) result.stopName = `${result.stopName}`;

    if (result.success && result.departures) {
        result.departures = result.departures.slice(0, DEPARTURES_PER_STOP_MEDIUM);
    }
    return result;
}

function timeInfoMediumWidget(dep) {

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
    const column = parentStack.addStack();
    column.layoutVertically();

    if (!departures || departures.length === 0) {
        let message = `No departures for\n${(stopName || `Stop ${stopIndex + 1}`).split(" (")[0]}.`; // Keep it short
        if (success && noFutureDepartures) message = `No future deps for\n${(stopName || `Stop ${stopIndex + 1}`).split(" (")[0]}.`;
        else if (!success && stopName.startsWith("Err")) message = `${stopName}`;
        else if (!success) message = `Could not load for\n${(stopName || `Stop ${stopIndex + 1}`).split(" (")[0]}.`;
        
        const noDepText = column.addText(message);
        noDepText.font = Font.systemFont(10);
        noDepText.textColor = GRAY_TEXT;
        noDepText.centerAlignText();
        column.addSpacer(); // Fill space
        return column;
    }

    for (const dep of departures) {
        const row = column.addStack();
        row.layoutHorizontally();
        row.centerAlignContent();
        row.spacing = 1;

        const lineStack = row.addStack();
        lineStack.size = new Size(35, 0);
        lineStack.layoutHorizontally();
        const lineText = lineStack.addText(dep.line);
        lineText.font = Font.boldSystemFont(12);
        lineText.textColor = TEXT_BLACK;
        lineStack.addSpacer(2);

        const dirStack = row.addStack();
        dirStack.size = new Size(70, 0);
        dirStack.layoutHorizontally();
        const dirText = dirStack.addText(dep.headsign);
        dirText.font = Font.systemFont(14);
        dirText.textColor = TEXT_BLACK;
        dirText.lineLimit = 1;
        dirText.minimumScaleFactor = 0.8;
        dirStack.addSpacer();

        row.addSpacer(); // Pushes time to the right

        const acTimeStack = row.addStack();
        acTimeStack.layoutHorizontally();
        acTimeStack.centerAlignContent();
        if (dep.airConditioned) {
            const acText = acTimeStack.addText("❄︎");
            acText.font = Font.systemFont(10);
            acText.textColor = AC_BLUE;
            acTimeStack.addSpacer(2);
        }
        const { color, text: timeValue } = timeInfoMediumWidget(dep);
        const timeText = acTimeStack.addText(timeValue);
        timeText.font = Font.boldSystemFont(12);
        timeText.textColor = color;
        column.addSpacer(2); // Spacing between departure rows
    }
    return column;
}

async function createMediumWidget() {
    const widget = new ListWidget();
    widget.backgroundColor = BACKGROUND;
    widget.setPadding(20, 15, 15, 15); 
    widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

 
    const stopDataPromises = STOP_ASW_IDS_MEDIUM.map((aswId, index) => {
        const cisId = STOP_CIS_IDS_MEDIUM[index] || ''; // Fallback to empty if CIS array is shorter
        return fetchDeparturesForMediumWidgetStop(aswId || '', cisId, index);
    });
    
    // Wait for data for up to 2 stops.
    const fetchedStopData = await Promise.all(stopDataPromises.slice(0,2));
    const stopAData = fetchedStopData[0] || { departures: [], stopName: "Stop 1 N/A", success: false };
    const stopBData = fetchedStopData[1] || { departures: [], stopName: "Stop 2 N/A", success: false };


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
    const stopBInnerStack = stopBOuterContainer.addStack(); // To allow right alignment of text
    stopBInnerStack.layoutHorizontally();
    stopBInnerStack.addSpacer(); // Pushes text to the right
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
    widget.addSpacer(); // Dynamic spacer before footer

    const bottomStack = widget.addStack();
    bottomStack.layoutHorizontally();
    bottomStack.addSpacer(); // Center the text
    const now_footer = new Date();
    const timeStr = `${now_footer.getHours().toString().padStart(2, '0')}:${now_footer.getMinutes().toString().padStart(2, '0')}`;
    const updateText = bottomStack.addText(`Updated: ${timeStr}`);
    updateText.font = Font.systemFont(8);
    updateText.textColor = GRAY_TEXT;
    updateText.textOpacity = 0.8;
    bottomStack.addSpacer(); // Center the text
    return widget;
}

// =========================================
// --- MAIN SCRIPT EXECUTION LOGIC ---
// =========================================
async function run() {
    let widgetToPresent;

    if (config.widgetFamily === 'large') {
        widgetToPresent = await createLargeWidget();
    } else if (config.widgetFamily === 'medium') {
        widgetToPresent = await createMediumWidget();
    } else {
        // Fallback for small, extraLarge, or undefined (e.g., when run in app editor)
        widgetToPresent = new ListWidget();
        const text = widgetToPresent.addText("Configure widget size (Large or Medium).");
        text.font = Font.systemFont(12);
        text.centerAlignText();
         if (!config.runsInWidget && !config.widgetFamily) { // For in-app testing
            // To test a specific size in the app, uncomment one of these:
            // console.log("Testing Medium Widget in App");
            // widgetToPresent = await createMediumWidget();
            // console.log("Testing Large Widget in App");
            // widgetToPresent = await createLargeWidget();
        }
    }

    if (config.runsInWidget) {
        Script.setWidget(widgetToPresent);
    } else {
        if (widgetToPresent.constructor.name === "ListWidget" && 
            (widgetToPresent.allTexts.length > 0 && widgetToPresent.allTexts[0].text.includes("Configure widget size"))
           ){
             await widgetToPresent.presentSmall(); 
        } else if (config.widgetFamily === 'large' || (await widgetToPresent === await createLargeWidget(false))) {
            await widgetToPresent.presentLarge();
        } else if (config.widgetFamily === 'medium' || (await widgetToPresent === await createMediumWidget(false))) {
            await widgetToPresent.presentMedium();
        } else {
             await widgetToPresent.presentMedium();
        }
    }
    Script.complete();
}

run().catch(err => {
    console.error(`Unhandled Script Error: ${err}\nStack: ${err.stack}`);
    if (config.runsInWidget) {
        let errorWidget = new ListWidget();
        errorWidget.addText(`Script Error. Check logs.\n${err.toString().substring(0,50)}`);
        Script.setWidget(errorWidget);
    } else {
        // When running in app, error is already logged to console.
        // Optionally present an error message for in-app run too.
        let errorWidget = new ListWidget();
        errorWidget.addText(`Script Error: ${err}`);
        errorWidget.presentSmall();
    }
    Script.complete();
});
