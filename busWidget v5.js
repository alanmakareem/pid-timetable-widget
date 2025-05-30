// PID Bus Timetable Widget - V5 (Fixed Line/Direction Display)
// --- WIDGET SETTINGS ---
const API_KEY = //GET YOUR API KEY FROM https://golemio.cz/api/ (free registration required);
const STOP_IDS = [/*'U424Z1P',*/ 'U424Z2P'];
const LOGO_URL = 'https://pid.cz/wp-content/uploads/2023/11/vizualni_podoba_01-scaled.jpg';
const MAX_DEPARTURES_TO_SHOW = 8;
const USE_MOCK_DATA = false;

// --- COLORS ---
const BACKGROUND = new Color("#FFFFFF");
const TEXT_BLACK = new Color("#000000");
const RED_TIME = new Color("#E53E3E");
const ORANGE_TIME = new Color("#FFA500");
const GREEN_TIME = new Color("#34C759");
const GRAY_TEXT = new Color("#8E8E93");
const PID_BLUE = new Color("#005C9E");

console.log("Script Starting...");

// --- HELPER: FETCH DEPARTURES ---
async function fetchDepartures(stopIds) {
    console.log("Fetching departures for stop IDs:", stopIds);
    let stopName = "PID Timetable"; // Default name
    if (USE_MOCK_DATA) {const now = new Date();
        const departures = [
            {
                line: "213",
                headsign: "Želivského",
                arrival: new Date(now.getTime() + 60000), // 1 min from now
                isDelayed: false,
                delayInSeconds: 0
            },
            {
                line: "136",
                headsign: "Sídliště Čakovice",
                arrival: new Date(now.getTime() + 120000), // 2 min from now
                isDelayed: true,
                delayInSeconds: 180 // 3 min delay
            },
            {
                line: "125",
                headsign: "Smíchovské Nádraží",
                arrival: new Date(now.getTime() + 240000), // 4 min from now
                isDelayed: false,
                delayInSeconds: 0
            }
        ];
        return { departures, stopName: "Chodovská Tvrz" };
    }; 

    const idParams = stopIds.map(id => `ids[]=${id}`).join('&');
    const url = `https://api.golemio.cz/v2/pid/departureboards?${idParams}&limit=20&minutesAfter=120`;
    const req = new Request(url);
    req.headers = { 'x-access-token': API_KEY };

    try {
        const data = await req.loadJSON();
        console.log("API Raw Response Received.");
        // console.log("RAW_DATA_START>>>" + JSON.stringify(data) + "<<<RAW_DATA_END");

        if (!data || !data.departures) {
            console.error("API Error: No 'departures' field.");
            return { departures: [], stopName };
        }
        
        if (data.stops && data.stops.length > 0) {
            stopName = data.stops[0].stop_name;
            console.log("Fetched stop name:", stopName);
        }

        console.log(`Found ${data.departures.length} raw departures.`);

        const mapped = data.departures.map(dep => {
            const arrivalTime = dep.departure_timestamp.predicted || dep.departure_timestamp.scheduled;
            if (!arrivalTime) return null; 
            return {
                line: dep.route ? dep.route.short_name : 'N/A',
                headsign: dep.trip ? dep.trip.headsign : 'N/A',
                arrival: new Date(arrivalTime),
                isDelayed: dep.delay && dep.delay.is_delayed,
                delayInSeconds: dep.delay ? dep.delay.seconds : 0
            };
        });
        
        const nonNull = mapped.filter(dep => dep !== null);
        const validDates = nonNull.filter(dep => !isNaN(dep.arrival.getTime()));
        const now = new Date();
        const futureDates = validDates.filter(dep => (dep.arrival - now) > -30000); 

        console.log(`Filtered to ${futureDates.length} valid departures.`);
        futureDates.sort((a, b) => a.arrival - b.arrival);
        console.log("Departures sorted.");
        
        return { departures: futureDates, stopName: stopName };

    } catch (e) {
        console.error(`API Fetch/Parse Error: ${e}`);
        return { departures: [], stopName: "Error" };
    }
}

// --- HELPER: CREATE WIDGET LAYOUT ---
async function createLayout(widget, departuresData) {
    const departures = departuresData.departures;
    const stopName = departuresData.stopName;

    console.log(`Creating layout for ${stopName} with ${departures.length} departures.`);
    widget.backgroundColor = BACKGROUND;
    widget.setPadding(15, 15, 10, 15);

    const headerStack = widget.addStack();
    headerStack.layoutHorizontally();
    headerStack.centerAlignContent();

    try {
        const logoReq = new Request(LOGO_URL);
        const logoImg = await logoReq.loadImage();
        const logo = headerStack.addImage(logoImg);
        logo.imageSize = new Size(50, 40);
        logo.cornerRadius = 4;
    } catch (e) {
        const logoText = headerStack.addText("PID");
        logoText.font = Font.boldSystemFont(16);
        logoText.textColor = PID_BLUE;
    }

    headerStack.addSpacer(8);
    const stopNameText = headerStack.addText(stopName);
    stopNameText.font = Font.boldSystemFont(28);
    stopNameText.textColor = TEXT_BLACK;
    stopNameText.minimumScaleFactor = 0.7;
    headerStack.addSpacer();
    widget.addSpacer(12);

    const departureCountToShow = Math.min(MAX_DEPARTURES_TO_SHOW, departures.length);

    if (departureCountToShow === 0) {
        const noBusText = widget.addText("No departures found at this time.");
        noBusText.font = Font.systemFont(14);
        noBusText.textColor = GRAY_TEXT;
        noBusText.centerAlignText();
    } else {
        for (let i = 0; i < departureCountToShow; i++) {
            const dep = departures[i];
            addDepartureRow(widget, dep);
            if (i < departureCountToShow - 1) {
                widget.addSpacer(4); 
            }
        }
    }
    
    for (let i = departureCountToShow; i < MAX_DEPARTURES_TO_SHOW; i++) {
         widget.addSpacer(8);
    }

    widget.addSpacer();

    // Add bottom divider line
    const divider = widget.addStack();
    divider.addSpacer();
    const ctx = new DrawContext();
    ctx.size = new Size(450, 5);
    ctx.opaque = false;
    ctx.setFillColor(RED_TIME);
    ctx.fillRect(new Rect(0, 0, 500, 2));
    divider.addImage(ctx.getImage());
    divider.addSpacer();
    widget.addSpacer(4);


    widget.addSpacer(1);
    const now_footer = new Date();
    const timeStr = `${now_footer.getHours().toString().padStart(2, '0')}:${now_footer.getMinutes().toString().padStart(2, '0')}`;
    const updateText = widget.addText(`Updated: ${timeStr}`);
    updateText.font = Font.systemFont(10);
    updateText.textColor = GRAY_TEXT;
    updateText.textOpacity = 0.8;
    updateText.rightAlignText();
    console.log("Layout creation finished.");
}

// --- HELPER: ADD DEPARTURE ROW (Restored Line/Direction) ---
function addDepartureRow(widget, departure) {
    const rowStack = widget.addStack();
    rowStack.layoutHorizontally();
    rowStack.centerAlignContent();
    rowStack.spacing = 12;
    rowStack.size = new Size(0, 26);

    // --- RESTORED: Bus Line Badge ---
    const lineStack = rowStack.addStack();
    lineStack.backgroundColor = PID_BLUE;
    lineStack.cornerRadius = 4;
    lineStack.setPadding(3, 8, 3, 8);
    const lineText = lineStack.addText(String(departure.line));
    lineText.font = Font.boldSystemFont(16);
    lineText.textColor = new Color("#FFFFFF");

    // --- RESTORED: Direction ---
    const directionText = rowStack.addText(String(departure.headsign));
    directionText.font = Font.boldSystemFont(16);
    directionText.textColor = TEXT_BLACK;
    directionText.lineLimit = 1;
    directionText.minimumScaleFactor = 1;

    rowStack.addSpacer(); // Pushes time info to the right

    // Time Info Stack
    const timeStack = rowStack.addStack();
    timeStack.layoutHorizontally();
    timeStack.centerAlignContent();

    const now_time = new Date(); 
    const arrival = departure.arrival;
    
    if (isNaN(arrival.getTime())) {
         const timeLabel = timeStack.addText("?? min");
         timeLabel.font = Font.boldSystemFont(16);
         timeLabel.textColor = GRAY_TEXT;
         return;
    }

    const secs_remaining = (arrival - now_time) / 1000;
    let timeColor, timeText;

    if (secs_remaining <= 10) {
        timeColor = RED_TIME;
        timeText = "Now";
    } else if (secs_remaining < 30) {
        timeColor = RED_TIME;
        timeText = "< 1 min";
    } else {
        const mins = Math.floor(secs_remaining / 60);
        timeText = `${mins} min`;
        if (mins >= 5) {
             timeColor = GREEN_TIME;
        } else if (mins >= 2) {
             timeColor = ORANGE_TIME;
        } else {
             timeColor = RED_TIME;
        }
    }

    // Add delay info FIRST
    if (departure.isDelayed && departure.delayInSeconds > 60) {
        const delayMins = Math.round(departure.delayInSeconds / 60);
        const delayLabel = timeStack.addText(`+${delayMins} `);
        delayLabel.font = Font.boldSystemFont(12);
        delayLabel.textColor = GRAY_TEXT;
    }

    // Add main time
    const timeLabel = timeStack.addText(timeText);
    timeLabel.font = Font.boldSystemFont(16);
    timeLabel.textColor = timeColor;
}

// --- MAIN WIDGET CREATION ---
async function createWidget() {
    console.log("Creating widget object...");
    const widget = new ListWidget();
    widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);

    const departuresData = await fetchDepartures(STOP_IDS);
    await createLayout(widget, departuresData);
    console.log("Widget creation complete.");
    return widget;
}

// --- SCRIPT EXECUTION ---
console.log("Starting execution block...");
try {
    let widget = await createWidget();
    if (config.runsInWidget) {
        Script.setWidget(widget);
    } else {
        widget.presentLarge();
    }
    Script.complete();
    console.log("Script completed successfully.");
} catch (error) {
    console.error(`Script Execution Error: ${error}`);
    let errorWidget = new ListWidget();
    errorWidget.addText("Error loading widget. Check logs.");
    Script.setWidget(errorWidget);
    Script.complete();
}