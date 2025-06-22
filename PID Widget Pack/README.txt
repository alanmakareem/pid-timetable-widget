PID Timetable Widget — README
=============================

BUY ME A BEER
-------------
paypal.me/alanmakarim

OVERVIEW
--------
PID Timetable Widget is a Scriptable script that displays real-time departure boards for Prague Integrated Transport (PID).  
The script stores only stop coordinates locally; every timetable request goes to the official Golemio / PID API, so the widget **cannot work offline**.

IMPORTANT USAGE NOTE
--------------------
Do **NOT** place this script in a regular Home-Screen widget.  
iOS refreshes widgets on its own schedule and the script will appear **blank** most of the time.

Instead, run the script via the Shortcuts app and trigger that shortcut from:
• Control Center (recommended)  
• Back-Tap gesture  
• Action button (iPhone 15 Pro)  
• The Scriptable app itself  

This on-demand model guarantees that the departure board is always current when you open it.

FILE LAYOUT
-----------
/Scriptable  
 ├─ PID-Widget-4.3.1.js   ← main script with editable settings  
 └─ pid_stops_db.json     ← static list of stops (≈ 12 000 rows)  

INSTALLATION
------------
1. Copy both files to **iCloud Drive → Scriptable**.
2, Open the file with Scriptable and select "Add to my script" or, 
    copy whole code in PID Widget 4.3.1, then in Scriptable tap “+”, and paste the code and save it as PID Widget 4.3.1
3. Run the script once and grant **Location** permission so it can find nearby stops.

GETTING A PERSONAL API KEY
--------------------------
1. Visit **https://api.golemio.cz** and create a free account.  
2. In the dashboard create a new application and copy your **API token**.  
3. Open `PID Widget 4.3.1.js` in Scriptable and replace the placeholder:  
   const API_KEY = "YOUR_API_KEY_HERE";

CREATING A SHORTCUT & ADDING IT TO CONTROL CENTER
-------------------------------------------------
1. Open the **Shortcuts** app → tap "+" → *New Shortcut* → rename it “PID Departures” or anything you like such as "Bus Timetable".  
2. Tap **Add Action** → *Apps* → *Scriptable* → **Run Script**, then pick `PID Widget 4.3.1.js`.  
3. Swipe down to access the Control Center → tap "+" on the top left → **Add a control** → select **Shortcut** app → and choose the "PID Departure" or the shortcut name you made earlier. 
   • to change the icon, you can do it in the Shortcut app by **Choose Icon** when editing the shortcut.
4. Arrange the shortcut on your Control Center as you like.
Now pull down Control Center and tap the icon whenever you need up-to-date departures.

ADJUSTABLE SETTINGS
-------------------
Edit the constants at the very top of the script:

API_KEY                         – your personal Golemio token (no default)  
SEARCH_RADIUS_METERS            – radius (m) for nearby stops        [300]  
MAX_DEPARTURES_TO_SHOW          – number of rows displayed           [7]   
SHOW_NEXT_ARRIVAL_INFO          – merge same-platform departures     [true]  
SORT_BY_CLOSEST_STOP_ONLY       – if true, never mixes stops         [false]  
AVERAGE_WALKING_SPEED_MPS       – metres / second for ETA            [1.3]  
WALKING_TIME_BUFFER_MINUTES_*   – extra minutes (default / metro)    [0 / 0.5]

All colour choices and the logo are hard-coded to keep configuration simple.

VERSION HISTORY
---------------
4.3.1  Grouped “Next Arrival” logic, Control Center workflow.

CREDITS
-------
UI design: **Alan Makareem**  alan.fmakarim@gmail.com
Data: Golemio Open Data API & Prague Integrated Transport (PID)  
