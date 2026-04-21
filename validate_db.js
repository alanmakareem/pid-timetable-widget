const fs = require('fs');

async function validate() {
    const stopsTxt = fs.readFileSync('stops.txt', 'utf8');
    const gtfsStops = new Set();
    const gtfsParentStops = new Set();

    // Parse GTFS stops.txt
    const lines = stopsTxt.split('\n');
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',');
        const stopId = cols[0].replace(/"/g, '');
        gtfsStops.add(stopId);

        // Try stripping 'P' and adding to a parent set
        if (stopId.endsWith('P')) {
            gtfsParentStops.add(stopId.slice(0, -1));
        } else if (stopId.includes('_')) {
             gtfsParentStops.add(stopId.split('_')[0].replace(/P$/, ''));
        } else {
             gtfsParentStops.add(stopId);
        }
    }

    const pidDb = JSON.parse(fs.readFileSync('PID Widget Pack/pid_stops_db.json', 'utf8'));

    let totalChecked = 0;
    let missingInGtfs = [];

    for (const stop of pidDb) {
        let idToCheck = stop.id;

        if (idToCheck.includes('_')) {
            idToCheck = idToCheck.split('_')[0];
        }
        if (idToCheck.endsWith('P')) {
            idToCheck = idToCheck.slice(0, -1);
        }

        // Since the DB has removed 'P', we check our normalized gtfsParentStops set
        if (!gtfsParentStops.has(idToCheck) && !gtfsStops.has(idToCheck)) {
            missingInGtfs.push(idToCheck);
        }
        totalChecked++;
    }

    console.log(`Total DB stops checked: ${totalChecked}`);
    console.log(`DB stops missing from GTFS: ${missingInGtfs.length}`);
    if (missingInGtfs.length > 0) {
        console.log("Sample of missing IDs:");
        console.log(missingInGtfs.slice(0, 20));
    } else {
        console.log("All DB stops successfully validated against GTFS data!");
    }
}

validate().catch(console.error);
