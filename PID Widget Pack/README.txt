PID Timetable Widget — README
=============================

🚋 PID Timetable Widget for Scriptable
A smart, location-aware iOS widget for Prague Public Transport (PID). This widget runs on the Scriptable app and uses the Golemio API to provide real-time departures, delays, and platform information.

✨ Key Features (v5.3.4)
📍 GPS Location Aware: Automatically finds the nearest stops within a 250-400m radius.
🧠 Smart Walking Filter: Calculates your walking speed (1.3 m/s) against the bus departure time. If you can't physically make it to the stop, the bus is hidden from the list.
🏗 Platform Grouping: Departures are grouped by specific stands (e.g., Kačerov — A, Kačerov — B), so you know exactly where to wait.⏱ Real-Time Data: Shows live delays (+3 min), air-conditioning status (❄︎), and wheelchair accessibility (♿︎).
🌑 Dark Mode Support: Fully adapts to iOS Light and Dark system themes.
🚅 Multi-Mode Badges: Color-coded badges for Metro (A/B/C), Trams, and Buses.

📲 Installation
1. Prerequisites
  - iPhone with iOS 16+.
  - Scriptable App (Free).
  - Golemio API Key (Get one for free at api.golemio.cz).
2. Setup Guide
-- Download the Code:
  - Go to the PID Widget Pack folder in this repository.
  - Copy the content of the latest version (e.g., Ver. 5.3 4.js).
  - Open Scriptable, create a new script, and paste the code.
-- Add the Database (Critical):
  - This widget requires a local database of stop coordinates to work offline/quickly.
  - Download the pid_stops_db.json file from this repository.
  - Move this file into your iCloud Drive > Scriptable folder (or local Scriptable folder if not using iCloud).
-- Configure API Key:
  - Open the script you created.
  - Find the line const API_KEY = "...".
  - Replace the text inside the quotes with your personal Golemio API token.
-- Add to Home Screen:
  - Add a "Scriptable" widget to your iOS Home Screen.
  - Set the Script parameter to your saved script name.
  - Set Parameter (optional) or leave blank.

⚙️ Configuration
You can customize the logic at the top of the script file:
const SEARCH_RADIUS_METERS = 250;      // How far to search for stops
const MAX_PLATFORM = 5;                // Max number of platforms to show
const AVERAGE_WALKING_SPEED_MPS = 1.3; // Your walking speed in meters/second
const SHOW_NEXT_ARRIVAL_INFO = false;  // Show "➜ 14:05" preview for next bus

📜 Version History
v5.3.4 (Latest Stable)
- Platform Grouping: Departures are now separated by platform header (e.g., "Stand A").
- GPS Accuracy: Footer now shows GPS signal confidence (e.g., ±10m).
- UI Polish: Slimmer dividers and "Nearby" indicator for stops <50m.

v4.3.6 (Smart Commuter)
- Walking Filter: Filters out "uncatchable" connections.
- Absolute Time: Displays 14:35 format for departures >10 mins away.

v3.3 (GPS Core)
- GPS Logic: Moved from hardcoded IDs to Location.current() detection.
- De-duplication: Prevents seeing the same bus twice when standing between stops.

🐞 Troubleshooting
"Database not found" Error: Ensure the file is named exactly pid_stops_db.json and is located directly in the root of the Scriptable folder in your Files app.
"No Stops Found": The widget searches a 250m radius by default. If you are in a remote area, it will attempt to find the single nearest stop, even if it is kilometers away.
"No Catchable Departures": This means there are buses, but based on your AVERAGE_WALKING_SPEED_MPS, the widget calculated that you cannot make it in time.

📂 QA & Documentation
For developers and contributors, this repository includes a dedicated QA folder containing:
- Master Documentation: Full changelogs and feature breakdowns.
- Test Reports: Comprehensive validation of GPS logic, walking filters, and platform grouping.
- Bug Reports: A detailed log of resolved defects (e.g., the "Ghost Bus" issue or the "Trailing P" fix).

📄 License
This project is open-source. Feel free to modify and improve!

BUY ME A BEER
-------------
paypal.me/alanmakarim
