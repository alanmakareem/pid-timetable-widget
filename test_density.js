const fs = require('fs');

function extractCode() {
  const file = fs.readFileSync("PID Widget Pack/PID Widget 5.4.1.js", 'utf8');

  // Find where platformCount is determined and TOTAL_ROWS is calculated
  const match = file.match(/(const platformCount = uniquePlatforms\.size;[\s\S]*?)const picked = stream\.slice\(0, TOTAL_ROWS\);/m);
  if (match) {
    console.log(match[0]);
  }
}
extractCode();
