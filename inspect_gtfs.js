const fs = require('fs');

const stopsTxt = fs.readFileSync('stops.txt', 'utf8');
const lines = stopsTxt.split('\n');

const sampleIds = [
  'U1Z1',  'U1Z2',  'U4Z1',
  'U4Z2',  'U4Z3',  'U4Z4'
];

console.log("Looking for similar IDs in GTFS...");
let count = 0;
for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',');
    const stopId = cols[0].replace(/"/g, '');

    if (sampleIds.some(sid => stopId.includes(sid.slice(0, 3)))) {
        console.log("GTFS MATCH:", stopId);
        count++;
    }
    if (count > 20) break;
}
