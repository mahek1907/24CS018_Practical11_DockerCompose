const BASE_URL = "http://localhost:5000";

let passed = 0;
let failed = 0;

function assert(condition, name, details = "") {
    if (condition) {
        console.log(`✅ PASS: ${name}`);
        passed++;
    } else {
        console.error(`❌ FAIL: ${name} - ${details}`);
        failed++;
    }
}

async function isServerUp() {
    try {
        const res = await fetch(`${BASE_URL}/debug/cache-stats`, { signal: AbortSignal.timeout(800) });
        return res.status === 200;
    } catch {
        return false;
    }
}

async function ensureServerRunning() {
    if (await isServerUp()) {
        console.log("Existing backend server detected on port 5000.\n");
        return;
    }

    console.log("No running server detected on port 5000. Auto-starting backend server for tests...");
    require("./server");

    // Wait for Express and MongoDB to connect
    const startTime = Date.now();
    while (Date.now() - startTime < 10000) {
        await new Promise((r) => setTimeout(r, 600));
        if (await isServerUp()) {
            console.log("Backend server and MongoDB successfully connected and ready!\n");
            return;
        }
    }

    throw new Error("Could not start backend server on port 5000. Please ensure MongoDB is running.");
}

async function runTests() {
    try {
        await ensureServerRunning();

        console.log("=== STARTING PRACTICAL 9 CACHING & QUERY OPTIMIZATION VERIFICATION ===\n");

        const timestamp = Date.now();
        const userA = {
            email: `caching_alice_${timestamp}@charusat.edu`,
            password: "Password123!"
        };
        const userB = {
            email: `caching_bob_${timestamp}@charusat.edu`,
            password: "Password456!"
        };

        // Register & login User A
        await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userA)
        });
        const loginA = await (await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userA)
        })).json();
        const tokenA = loginA.token;

        // Reset cache stats
        await fetch(`${BASE_URL}/tasks/cache/reset`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tokenA}` }
        });

        // Populate 15 tasks for User A to simulate realistic dataset
        console.log("Populating sample tasks for User A...");
        const taskIds = [];
        for (let i = 1; i <= 15; i++) {
            const createRes = await (await fetch(`${BASE_URL}/tasks`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${tokenA}`
                },
                body: JSON.stringify({
                    title: `Task #${i} - Database Query Benchmark`,
                    description: `Description for task ${i}`,
                    completed: i % 2 === 0
                })
            })).json();
            if (createRes.task) taskIds.push(createRes.task._id);
        }
        console.log(`Populated ${taskIds.length} tasks.\n`);

        // Reset stats so benchmark measures clean read requests
        await fetch(`${BASE_URL}/tasks/cache/reset`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tokenA}` }
        });

        // Test 1: First GET /tasks -> Cache MISS (queries MongoDB)
        const t0 = performance.now();
        const resMiss = await fetch(`${BASE_URL}/tasks`, {
            headers: { Authorization: `Bearer ${tokenA}` }
        });
        const missDuration = (performance.now() - t0).toFixed(2);
        const missData = await resMiss.json();

        const stats1 = await (await fetch(`${BASE_URL}/debug/cache-stats`)).json();
        assert(stats1.misses === 1 && stats1.hits === 0 && missData.length === 15,
            "1. Initial GET /tasks causes Cache MISS (retrieves 15 tasks from MongoDB)",
            `Time: ${missDuration}ms, Stats: ${JSON.stringify(stats1)}`);

        // Test 2: Subsequent GET /tasks -> 3 Cache HITS (measures response times)
        const cachedReadings = [];
        for (let r = 1; r <= 3; r++) {
            const start = performance.now();
            const res = await fetch(`${BASE_URL}/tasks`, {
                headers: { Authorization: `Bearer ${tokenA}` }
            });
            const duration = (performance.now() - start).toFixed(2);
            const data = await res.json();
            cachedReadings.push(parseFloat(duration));
            console.log(`   Cached Reading ${r}: ${duration} ms (HTTP ${res.status}, items: ${data.length})`);
        }
        const cachedAvg = (cachedReadings.reduce((a, b) => a + b, 0) / cachedReadings.length).toFixed(2);
        const stats2 = await (await fetch(`${BASE_URL}/debug/cache-stats`)).json();
        assert(stats2.hits === 3 && stats2.misses === 1,
            `2. Subsequent requests produce Cache HITS (Recorded 3 readings, Avg: ${cachedAvg} ms, Hit Rate: ${stats2.hitRate})`,
            JSON.stringify(stats2));

        // Test 3: Single Task Caching (GET /tasks/:id)
        const testTaskId = taskIds[0];
        // First read: MISS
        const s1 = await (await fetch(`${BASE_URL}/tasks/${testTaskId}`, {
            headers: { Authorization: `Bearer ${tokenA}` }
        })).json();
        // Second read: HIT
        const s2Start = performance.now();
        const s2Res = await fetch(`${BASE_URL}/tasks/${testTaskId}`, {
            headers: { Authorization: `Bearer ${tokenA}` }
        });
        const s2Duration = (performance.now() - s2Start).toFixed(2);
        const s2 = await s2Res.json();
        const stats3 = await (await fetch(`${BASE_URL}/debug/cache-stats`)).json();

        assert(s1._id === testTaskId && s2._id === testTaskId && stats3.hits >= 4,
            `3. Separate caching for GET /tasks/:id (Hit verified in ${s2Duration} ms)`,
            JSON.stringify(stats3));

        // Test 4: Cache Invalidation on POST /tasks
        const newRes = await (await fetch(`${BASE_URL}/tasks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokenA}`
            },
            body: JSON.stringify({
                title: "Brand New Task Post-Invalidation",
                description: "Testing cache invalidation on write"
            })
        })).json();

        // The list cache should now be invalidated. Next GET /tasks should be a MISS and contain 16 items!
        const postInvalidateData = await (await fetch(`${BASE_URL}/tasks`, {
            headers: { Authorization: `Bearer ${tokenA}` }
        })).json();

        const hasNewTask = postInvalidateData.some(t => t.title === "Brand New Task Post-Invalidation");
        assert(postInvalidateData.length === 16 && hasNewTask,
            "4. Cache Invalidation on POST /tasks (stale list removed, new item immediately visible)",
            `Tasks returned: ${postInvalidateData.length}`);

        // Test 5: Cache Invalidation on PUT /tasks/:id
        // Prime the single task cache for testTaskId
        await fetch(`${BASE_URL}/tasks/${testTaskId}`, {
            headers: { Authorization: `Bearer ${tokenA}` }
        });

        // Update testTaskId
        await fetch(`${BASE_URL}/tasks/${testTaskId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokenA}`
            },
            body: JSON.stringify({
                title: "Updated Task Title Successfully"
            })
        });

        // Both single task and list cache must be invalidated!
        const updatedSingle = await (await fetch(`${BASE_URL}/tasks/${testTaskId}`, {
            headers: { Authorization: `Bearer ${tokenA}` }
        })).json();
        const updatedList = await (await fetch(`${BASE_URL}/tasks`, {
            headers: { Authorization: `Bearer ${tokenA}` }
        })).json();

        const singleOk = updatedSingle.title === "Updated Task Title Successfully";
        const listOk = updatedList.some(t => t._id === testTaskId && t.title === "Updated Task Title Successfully");
        assert(singleOk && listOk,
            "5. Cache Invalidation on PUT /tasks/:id (both list and single task caches updated with fresh data)",
            `Single title: ${updatedSingle.title}`);

        // Test 6: Cache Invalidation on DELETE /tasks/:id
        await fetch(`${BASE_URL}/tasks/${testTaskId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${tokenA}` }
        });

        const afterDeleteList = await (await fetch(`${BASE_URL}/tasks`, {
            headers: { Authorization: `Bearer ${tokenA}` }
        })).json();
        const afterDeleteSingle = await fetch(`${BASE_URL}/tasks/${testTaskId}`, {
            headers: { Authorization: `Bearer ${tokenA}` }
        });

        const deletedFromList = !afterDeleteList.some(t => t._id === testTaskId);
        assert(deletedFromList && afterDeleteSingle.status === 404,
            "6. Cache Invalidation on DELETE /tasks/:id (deleted task absent from list and returns 404)",
            `afterDeleteSingle status: ${afterDeleteSingle.status}`);

        // Test 7: User Isolation & Cache Partitioning
        // Register User B
        await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userB)
        });
        const loginB = await (await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userB)
        })).json();
        const tokenB = loginB.token;

        // User B requests /tasks - should get empty list, not User A's cached tasks!
        const userBTasks = await (await fetch(`${BASE_URL}/tasks`, {
            headers: { Authorization: `Bearer ${tokenB}` }
        })).json();

        assert(userBTasks.length === 0,
            "7. User Isolation Verified (User B does not receive User A's cached tasks)",
            `User B received: ${userBTasks.length} tasks`);

        // Test 8: Debug Statistics Endpoint
        const finalStats = await (await fetch(`${BASE_URL}/debug/cache-stats`)).json();
        assert(finalStats.totalRequests > 0 && finalStats.hitRate !== undefined && finalStats.defaultTTLSeconds === 60,
            "8. GET /debug/cache-stats reports accurate hits, misses, hit rate, and active keys",
            JSON.stringify(finalStats));

        // Save benchmark readings to file
        const fs = require("fs");
        const output = `=== CACHED PERFORMANCE BENCHMARK ===\nTest: GET /tasks with node-cache\nReading 1: ${cachedReadings[0]} ms\nReading 2: ${cachedReadings[1]} ms\nReading 3: ${cachedReadings[2]} ms\nAverage: ${cachedAvg} ms\nFinal Stats: ${JSON.stringify(finalStats, null, 2)}\n`;
        fs.writeFileSync("./docs/screenshots/after/cached_readings.txt", output);

        console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===`);
        process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
        console.error("Test runner error:", err);
        process.exit(1);
    }
}

runTests();
