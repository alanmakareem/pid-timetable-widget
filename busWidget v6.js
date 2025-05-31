// PID Bus Timetable Widget - V6 (with dot on left for delayed)

// --- WIDGET SETTINGS ---

const API_KEY = //GET YOUR API KEY FROM https://golemio.cz/api/ (free registration required);

const STOP_IDS = //['U424Z1P', 'U424Z2P', 'U424Z1', 'U424Z2']; /*Chodovska tvrz */
['U1040Z12P', 'U1040Z4P'] /*Andel D, F */

const LOGO_URL = 'https://raw.githubusercontent.com/alanmakareem/pid-timetable-widget/refs/heads/main/vizualni_podoba_01-scaled.png';

const MAX_DEPARTURES_TO_SHOW = 8;

const USE_MOCK_DATA = false;

// --- COLORS (Dynamic for light/dark mode) ---
const BACKGROUND = Color.dynamic(new Color("#FFFFFF"), new Color("#1C1C1E"));
const TEXT_BLACK = Color.dynamic(new Color("#000000"), new Color("#FFFFFF"));
const RED_TIME = Color.dynamic(new Color("#E53E3E"), new Color("#FF453A"));
const ORANGE_TIME = Color.dynamic(new Color("#FFA500"), new Color("#FFB340"));
const GREEN_TIME = Color.dynamic(new Color("#34C759"), new Color("#30D158"));
const GRAY_TEXT = Color.dynamic(new Color("#8E8E93"), new Color("#CCCCCC"));
const PID_BLUE = new Color("#005C9E");

console.log("Script Starting...");

// --- HELPER: FETCH DEPARTURES ---
async function fetchDepartures(stopIds) {
  console.log("Fetching departures for stop IDs:", stopIds);
  let stopName = "PID Timetable"; // Default name

  if (USE_MOCK_DATA) {
    const now = new Date();
    const departures = [
      {
        line: "213",
        headsign: "Želivského",
        scheduled: new Date(now.getTime() + 60000), // 1 min from now
        predicted: new Date(now.getTime() + 60000), // on time
        arrival: new Date(now.getTime() + 60000),
        isDelayed: false,
        delayInSeconds: 0
      },
      {
        line: "136",
        headsign: "Sídliště Čakovice",
        scheduled: new Date(now.getTime() + 120000), // 2 min from now
        predicted: new Date(now.getTime() + 180000), // 3 min from now (delayed by 1 min)
        arrival: new Date(now.getTime() + 180000),
        isDelayed: true,
        delayInSeconds: 60
      },
      {
        line: "125",
        headsign: "Smíchovské Nádraží",
        scheduled: new Date(now.getTime() + 240000), // 4 min from now
        predicted: new Date(now.getTime() + 240000), // on time
        arrival: new Date(now.getTime() + 240000),
        isDelayed: false,
        delayInSeconds: 0
      }
    ];
    return { departures, stopName: "Chodovská Tvrz" };
  }

  const idParams = stopIds.map(id => `ids[]=${id}`).join('&');
  const url = `https://api.golemio.cz/v2/pid/departureboards?${idParams}&limit=20&minutesAfter=120`;
  const req = new Request(url);
  req.headers = { 'x-access-token': API_KEY };

  try {
    const data = await req.loadJSON();
    if (data.stops && data.stops.length > 0) {
      stopName = data.stops[0].stop_name;
    }
    const mapped = data.departures.map(dep => {
      const scheduled = dep.departure_timestamp.scheduled ? new Date(dep.departure_timestamp.scheduled) : null;
      const predicted = dep.departure_timestamp.predicted ? new Date(dep.departure_timestamp.predicted) : scheduled;
      if (!scheduled) return null;
      const delaySeconds = (predicted - scheduled) / 1000;
      const isDelayed = delaySeconds > 59; // Delayed if more than 59 seconds
      return {
        line: dep.route ? dep.route.short_name : 'N/A',
        headsign: dep.trip ? dep.trip.headsign : 'N/A',
        scheduled: scheduled,
        predicted: predicted,
        arrival: predicted,
        isDelayed: isDelayed,
        delayInSeconds: delaySeconds > 0 ? Math.round(delaySeconds) : 0
      };
    });
    const nonNull = mapped.filter(dep => dep !== null);
    const validDates = nonNull.filter(dep => !isNaN(dep.arrival.getTime()));
    const now = new Date();
    const futureDates = validDates.filter(dep => (dep.arrival - now) > -30000);
    futureDates.sort((a, b) => a.arrival - b.arrival);
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
      if (i < departureCountToShow - 1) widget.addSpacer(4);
    }
    for (let i = departureCountToShow; i < MAX_DEPARTURES_TO_SHOW; i++) {
      widget.addSpacer(8);
    }
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

  // --- Updated time and legend at the bottom left ---
  const bottomStack = widget.addStack();
  bottomStack.layoutHorizontally();
  bottomStack.centerAlignContent();

  // Legend
  const legendStack = bottomStack.addStack();
  legendStack.layoutHorizontally();
  
  function legendDot(color, label, symbol = "") {
    // Dot
    const dot = legendStack.addText("●");
    dot.textColor = color;
    dot.font = Font.mediumSystemFont(10); // Dot size

    // Optional symbol
    if (symbol) {
      legendStack.addText(symbol);
    }

    // Label
    const labelText = legendStack.addText(" " + label + " ");
    labelText.font = Font.systemFont(10); // Label size
    labelText.textColor = GRAY_TEXT;      // Label color
  }

  // legendDot(GREEN_TIME, "On time");
  legendDot(ORANGE_TIME, "Delayed");
  // legendDot(RED_TIME, "<1 min");

  bottomStack.addSpacer();

  // Updated time (right side)
  const now_footer = new Date();
  const timeStr = `${now_footer.getHours().toString().padStart(2, '0')}:${now_footer.getMinutes().toString().padStart(2, '0')}`;
  const updateText = bottomStack.addText(`Updated: ${timeStr}`);
  updateText.font = Font.systemFont(10);
  updateText.textColor = GRAY_TEXT;
  updateText.textOpacity = 0.8;
  updateText.rightAlignText();
}

// --- HELPER: ADD DEPARTURE ROW (dot left of time if delayed) ---
function addDepartureRow(widget, departure) {
  const rowStack = widget.addStack();
  rowStack.layoutHorizontally();
  rowStack.centerAlignContent();
  rowStack.spacing = 12;
  rowStack.size = new Size(0, 26);

  // --- Bus Line Badge ---
  const lineStack = rowStack.addStack();
lineStack.backgroundColor = PID_BLUE;
lineStack.cornerRadius = 4;
lineStack.setPadding(3, 8, 3, 8);

// Set a fixed width for the badge (adjust 40 as needed for your font/size)
lineStack.size = new Size(45, 0);

const lineText = lineStack.addText(String(departure.line));
lineText.font = Font.boldSystemFont(16);
lineText.textColor = new Color("#FFFFFF");
lineText.centerAlignText();


  // --- Direction ---
  const directionText = rowStack.addText(String(departure.headsign));
  directionText.font = Font.boldSystemFont(16);
  directionText.textColor = TEXT_BLACK;
  directionText.lineLimit = 1;
  directionText.minimumScaleFactor = 1;

  rowStack.addSpacer(); // Pushes time info to the right

  // --- Time Info Stack ---
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
  let timeColor, timeText, showDot = false;

  if (departure.isDelayed) {
    timeColor = ORANGE_TIME;
    showDot = true;
    if (secs_remaining <= 10) {
      timeText = "Now";
    } else if (secs_remaining < 60) {
      timeText = "1 min";
    } else {
      const mins = Math.floor(secs_remaining / 60);
      timeText = `${mins} min`;
    }
  } else {
    if (secs_remaining <= 10) {
      timeColor = RED_TIME;
      timeText = "Now";
    } else if (secs_remaining < 60) {
      timeColor = RED_TIME;
      timeText = "1 min";
    } else {
      const mins = Math.floor(secs_remaining / 60);
      timeText = `${mins} min`;
      timeColor = GREEN_TIME;
    }
  }

  // --- Main time label (dot left if delayed) ---
  if (showDot) {
    const dot = timeStack.addText("●  ");
    dot.textColor = timeColor;
    dot.font = Font.boldSystemFont(8);
  }
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
