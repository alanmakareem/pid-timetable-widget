# 🚋 PID Timetable Widget for Scriptable

A smart, location-aware iOS widget for Prague Public Transport (PID). This widget runs on the [Scriptable](https://scriptable.app/) app and uses the [Golemio API](https://api.golemio.cz/) to provide real-time departures, delays, and platform information.

![PID Widget Preview](vizualni_podoba_01-scaled.png)

## ✨ Key Features (v5.3.4)

- **📍 GPS Location Aware**: Automatically finds the nearest stops within a 250-400m radius of your current location.
- **🧠 Smart Walking Filter**: Calculates your walking speed (default 1.3 m/s) against the bus departure time. If you can't physically make it to the stop, the bus is hidden from the list.
- **🏗 Platform Grouping**: Departures are grouped by specific stands (e.g., *Kačerov — A*, *Kačerov — B*), so you know exactly where to wait.
- **⏱ Real-Time Data**: Shows live delays, air-conditioning status (❄︎), and wheelchair accessibility (♿︎).
- **🌑 Dark Mode Support**: Fully adapts to iOS Light and Dark system themes.
- **🚅 Multi-Mode Badges**: Color-coded badges for Metro (A/B/C), Trams, and Buses.

---

## 📲 Installation Guide

### 1. Prerequisites
- iPhone with iOS 16+.
- **[Scriptable App](https://apps.apple.com/us/app/scriptable/id1405459188)** (Free).
- **Golemio API Key** (Get one for free at [api.golemio.cz](https://api.golemio.cz)).

### 2. Setup Steps

#### Step A: Download the Code
1. Open the file `PID Widget Pack/PID Widget 5.3.4.js` in this repository.
2. Copy the entire code.
3. Open the **Scriptable** app on your iPhone.
4. Create a new script (+) and paste the code.
5. Name it something like "PID Widget".

#### Step B: Add the Database (Critical)
*This widget requires a local database of stop coordinates to work offline/quickly.*

1. Download the `pid_stops_db.json` file from the `PID Widget Pack/` folder in this repository.
2. Open the **Files** app on your iPhone.
3. Move `pid_stops_db.json` into the `iCloud Drive > Scriptable` folder.
   - *Note: If you are not using iCloud, move it to the local `On My iPhone > Scriptable` folder.*
   - **Important:** The file must be named exactly `pid_stops_db.json`.

#### Step C: Configure API Key
1. Open the script you created in Scriptable.
2. Find the line `const API_KEY = "YOUR_API_KEY_HERE";` near the top.
3. Replace the text inside the quotes with your personal Golemio API token.

#### Step D: Add to Home Screen
1. Go to your iOS Home Screen.
2. Add a new **Scriptable** widget.
3. Tap the widget to edit it.
4. Set **Script** to the name of your saved script (e.g., "PID Widget").
5. The **Parameter** field can be left blank.

---

## ⚙️ Configuration

You can customize the widget's behavior by editing the variables at the top of the script:

```javascript
const SEARCH_RADIUS_METERS = 250;      // How far to search for stops (in meters)
const MAX_PLATFORM = 5;                // Max number of platforms to show per widget
const AVERAGE_WALKING_SPEED_MPS = 1.3; // Your walking speed in meters/second
const SHOW_NEXT_ARRIVAL_INFO = false;  // Set to true to see a preview of the next bus
```

---

## 🐞 Troubleshooting

- **"Database not found" Error**:
  - Ensure the file is named exactly `pid_stops_db.json`.
  - Ensure it is located directly in the root of the **Scriptable** folder in your Files app (not inside a subfolder).

- **"No Catchable Departures"**:
  - This means there are buses, but based on your `AVERAGE_WALKING_SPEED_MPS`, the widget calculated that you cannot make it to the stop in time.

- **"No Stops Found"**:
  - The widget searches a 250m radius by default. If you are in a remote area, try increasing `SEARCH_RADIUS_METERS` in the config.

---

## 📄 License
This project is open-source. Feel free to modify and improve!
