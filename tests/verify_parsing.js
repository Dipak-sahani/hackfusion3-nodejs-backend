function testParsing(timeStr) {
    const match = timeStr.match(/(\d+)(?::(\d+))?\s*([AP]M)?/i);
    if (!match) return { input: timeStr, isValid: false };

    let hours = parseInt(match[1]);
    let minutes = match[2] ? parseInt(match[2]) : 0;
    let ampm = match[3] ? match[3].toUpperCase() : '';

    if (ampm === 'PM' && hours < 12) hours += 12;
    else if (ampm === 'AM' && hours === 12) hours = 0;

    const fireTime = new Date();
    fireTime.setHours(hours, minutes, 0, 0);
    return {
        input: timeStr,
        output: fireTime.toLocaleString(),
        timestamp: Math.floor(fireTime.getTime() / 1000),
        isValid: !isNaN(fireTime.getTime())
    };
}

const testCases = ["08:00 AM", "08:00 PM", "9 pm", "10 am", "21:00", "8:30pm"];

testCases.forEach(tc => {
    const res = testParsing(tc);
    console.log(`Input: "${res.input}" -> ${res.output} (TS: ${res.timestamp}) Valid: ${res.isValid}`);
    if (!res.isValid) {
        console.error(`FAILED: ${res.input} produced NaN`);
        process.exit(1);
    }
});

console.log("ALL PARSING TESTS PASSED");
process.exit(0);
