# 🚋 PID Timetable Widget for Scriptable

A collection of iOS widgets for Prague Public Transport (PID) running on the [Scriptable](https://scriptable.app/) app.
Powered by the [Golemio API](https://api.golemio.cz/), these widgets provide real-time departures, delays, and platform information directly on your Home Screen.

![PID Widget Preview](vizualni_podoba_01-scaled.png)

## 📦 Choose Your Widget

This repository offers two main versions of the widget. Choose the one that fits your use case:

| Feature | **Smart Widget (v5.3.4)** | **Static Widget (v6.0)** |
| :--- | :--- | :--- |
| **Best For** | 🚶 Commuting & Exploring | 🏠 Home / 🏢 Work Monitor |
| **Stop Selection** | **Automatic (GPS)** <br> Finds nearest stops to you. | **Manual (Fixed)** <br> You define specific stop IDs. |
| **Smart Features** | ✅ **Walking Filter**: Hides buses you can't catch.<br>✅ **Platform Grouping**: Groups by stand (A, B...). | ❌ Standard list of departures. |
| **Setup** | **Advanced** <br> Requires installing a database file. | **Simple** <br> Copy-paste script & add API key. |
| **File Location** | `PID Widget Pack/PID Widget 5.3.4.js` | `busWidget v6.js` |

---

## 📍 Option A: Smart Widget (GPS Aware)
*Located in `PID Widget Pack/`*

The **Smart Widget** automatically detects your location and shows departures from the nearest stops. It calculates if you can make it to the stop in time based on your walking speed.

### ✨ Key Features
- **GPS Location Aware**: Automatically finds stops within a 250-400m radius.
- **Walking Filter**: Hides departures you cannot physically catch (assuming 1.3 m/s walking speed).
- **Platform Grouping**: Groups departures by stand (e.g., "Kačerov — Stand A").
- **Offline Database**: Uses a local JSON database for instant stop lookup.

### 📲 Installation Guide
1. **Download the Script**:
   - Open `PID Widget Pack/PID Widget 5.3.4.js`.
   - Copy the entire content.
   - Open **Scriptable**, create a new script, and paste the code.
2. **Add the Database (Critical)**:
   - Download `PID Widget Pack/pid_stops_db.json`.
   - Move this file to **iCloud Drive > Scriptable** (or the local Scriptable folder on your device).
   - *Note: The file must be named exactly `pid_stops_db.json`.*
3. **Configure**:
   - Get a free API key from [api.golemio.cz](https://api.golemio.cz).
   - In the script, replace `const API_KEY = "..."` with your key.

---

## 🏠 Option B: Static Widget (Fixed Stops)
*Located in root as `busWidget v6.js`*

The **Static Widget** is perfect if you always want to see departures from a specific stop (e.g., your local bus stop near home) regardless of where you are.

### ✨ Key Features
- **Simple & Fast**: No database file required.
- **New Visuals**: Updated v6 design with color-coded delay indicators (dots).
- **Dark Mode**: Fully supports iOS light and dark themes.

### 📲 Installation Guide
1. **Download the Script**:
   - Open `busWidget v6.js` (or `busWidget v5.js` for older style).
   - Copy the content into a new **Scriptable** script.
2. **Configure**:
   - **API Key**: Replace `const API_KEY` with your Golemio API token.
   - **Stop IDs**: Edit the `const STOP_IDS = ['...']` array with your desired Stop IDs (found via Golemio API or PID docs).
   - **Disable Mock Data**: Set `const USE_MOCK_DATA = false;` to see real live data.

---

## ⚙️ Configuration (Both Versions)

You can customize the logic at the top of the script files:

| Variable | Description |
| :--- | :--- |
| `API_KEY` | Your Golemio API Token. |
| `MAX_DEPARTURES_TO_SHOW` | Number of rows to display (default: 8). |
| `SEARCH_RADIUS_METERS` | *(Smart Only)* Distance to search for stops (default: 250m). |
| `AVERAGE_WALKING_SPEED_MPS` | *(Smart Only)* Your walking speed (default: 1.3 m/s). |

---

## 🐞 Troubleshooting

- **"Database not found" (Smart Widget)**: Ensure `pid_stops_db.json` is in the root of your Scriptable folder in the Files app.
- **"No Catchable Departures"**: The Smart Widget hides buses if it calculates you are too far away to walk there in time.
- **"No Stops Found"**: Try increasing `SEARCH_RADIUS_METERS` if you are in a remote area.

## 📂 Project Structure
- `PID Widget Pack/` - Contains the GPS-aware Smart Widget and the required database.
- `busWidget v6.js` - Latest Static Widget (Manual IDs).
- `PID Widget 2.3.js` - Legacy configurable widget (Large/Medium sizes).

## 📄 License
This project is open-source. Feel free to modify and improve!
