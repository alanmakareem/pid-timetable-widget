const fs = require('fs');

try {
    const code = fs.readFileSync("PID Widget Pack/PID Widget 5.4.1.js", 'utf8');
    // Basic syntax check using new Function with async wrapper
    new Function(`async function wrapper() { ${code} }`);
    console.log("Syntax is valid!");
} catch (e) {
    console.error("Syntax error:", e);
}
