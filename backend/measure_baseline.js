const BASE_URL = "http://localhost:5000";

async function measureBaseline() {
    console.log("=== CAPTURING BASELINE (UNCACHED) API PERFORMANCE ===\n");

    const user = {
        email: `baseline_user_${Date.now()}@charusat.edu`,
        password: "Password123!"
    };

    // 1. Register & Login
    await fetch(`${BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user)
    });

    const loginRes = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user)
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    // 2. Populate 15 realistic task items
    console.log("Populating sample tasks in MongoDB...");
    for (let i = 1; i <= 15; i++) {
        await fetch(`${BASE_URL}/tasks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                title: `Task item #${i} - Database Query Benchmark`,
                description: `Detailed description for task ${i} to test MongoDB read overhead without caching.`,
                completed: i % 2 === 0
            })
        });
    }
    console.log("15 sample tasks populated successfully.\n");

    // 3. Take 3 separate response time readings for GET /tasks
    const readings = [];
    for (let r = 1; r <= 3; r++) {
        const start = performance.now();
        const res = await fetch(`${BASE_URL}/tasks`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const end = performance.now();
        const data = await res.json();
        const duration = (end - start).toFixed(2);
        readings.push(parseFloat(duration));
        console.log(`Reading ${r}: ${duration} ms (HTTP ${res.status}, returned ${data.length} tasks)`);
    }

    const average = (readings.reduce((a, b) => a + b, 0) / readings.length).toFixed(2);
    console.log(`\nUncached Average Response Time: ${average} ms`);

    const fs = require("fs");
    const output = `Test: GET /tasks without caching\nReading 1: ${readings[0]} ms\nReading 2: ${readings[1]} ms\nReading 3: ${readings[2]} ms\nAverage: ${average} ms\nTimestamp: ${new Date().toISOString()}\n`;
    fs.writeFileSync("./docs/screenshots/before/baseline_readings.txt", output);
    console.log("Saved baseline readings to ./docs/screenshots/before/baseline_readings.txt");
}

measureBaseline().catch(console.error);
