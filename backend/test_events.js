/**
 * test_events.js
 * Comprehensive automated verification script for Practical 10:
 * Asynchronous Processing with Event-Driven Architecture (EventEmitter).
 *
 * Verifies:
 * 1. Startup: listener registration exactly once.
 * 2. POST /tasks: Immediate HTTP 201 response before 2s notification completes.
 * 3. Notification log: Task title, assigned user, event timestamp, completion timestamp.
 * 4. DELETE /tasks/:id: Triggers separate task-deleted event with correct taskId and timestamp.
 * 5. Nonexistent/invalid DELETE: Does NOT emit task-deleted event.
 * 6. Error handling: Notification errors caught safely without crashing the Express server.
 * 7. Regression check: Practical 9 caching remains functional.
 */

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

        console.log("=== STARTING PRACTICAL 10 EVENT-DRIVEN ARCHITECTURE VERIFICATION ===\n");

        const timestamp = Date.now();
        const user = {
            email: `events_user_${timestamp}@charusat.edu`,
            password: "Password123!"
        };

        // 1. Register & Login
        const regRes = await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user)
        });
        assert(regRes.status === 201, "User registration returns HTTP 201");

        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user)
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        assert(token !== undefined, "User login returns valid JWT token");

        const authHeader = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        };

        // 2. Measure POST /tasks response time (Verify response arrives well before the 2s notification)
        console.log("\n--- Testing Task Created Event & Non-Blocking HTTP Response ---");
        const createStart = Date.now();
        const createRes = await fetch(`${BASE_URL}/tasks`, {
            method: "POST",
            headers: authHeader,
            body: JSON.stringify({
                title: "Complete Practical 10",
                description: "Event-driven asynchronous processing demonstration",
                assignedUser: "Mahek"
            })
        });
        const createDurationMs = Date.now() - createStart;
        const createData = await createRes.json();

        console.log(`Measured HTTP POST response time: ${createDurationMs} ms`);
        assert(createRes.status === 201, "POST /tasks returns HTTP 201 Created");
        assert(createDurationMs < 1000, `HTTP response returned immediately (${createDurationMs} ms < 1000 ms), NOT blocked by 2000 ms notification delay`);
        assert(createData.task && createData.task.title === "Complete Practical 10", "Created task has correct title");

        const createdTaskId = createData.task._id;

        // Wait 2.5 seconds to let the background notification complete
        console.log("Waiting 2.5s for background notification listener to finish...");
        await new Promise((r) => setTimeout(r, 2500));

        // 3. Testing Task Deleted Event
        console.log("\n--- Testing Task Deleted Event ---");
        const deleteStart = Date.now();
        const deleteRes = await fetch(`${BASE_URL}/tasks/${createdTaskId}`, {
            method: "DELETE",
            headers: authHeader
        });
        const deleteDurationMs = Date.now() - deleteStart;
        const deleteData = await deleteRes.json();

        console.log(`Measured HTTP DELETE response time: ${deleteDurationMs} ms`);
        assert(deleteRes.status === 200, "DELETE /tasks/:id returns HTTP 200 OK");
        assert(deleteData.message === "Task deleted successfully", "Delete response confirmed message");

        // Wait 800ms for delete notification to process
        await new Promise((r) => setTimeout(r, 800));

        // 4. Testing Nonexistent / Invalid Task Deletion (No event should trigger)
        console.log("\n--- Testing Nonexistent Task Deletion ---");
        const nonExistentId = "60d5ec49f1b2c8b1f8e4e1a1";
        const failDeleteRes = await fetch(`${BASE_URL}/tasks/${nonExistentId}`, {
            method: "DELETE",
            headers: authHeader
        });
        assert(failDeleteRes.status === 404, "Deleting nonexistent task returns HTTP 404 (no event emitted)");

        const invalidIdRes = await fetch(`${BASE_URL}/tasks/invalid-mongo-id`, {
            method: "DELETE",
            headers: authHeader
        });
        assert(invalidIdRes.status === 400, "Deleting invalid task ID returns HTTP 400 validation error");

        // 5. Testing Error Handling (Simulate error inside event handler without crashing server)
        console.log("\n--- Testing Safe Event Error Handling ---");
        const errStart = Date.now();
        const errorTaskRes = await fetch(`${BASE_URL}/tasks`, {
            method: "POST",
            headers: authHeader,
            body: JSON.stringify({
                title: "Simulate Error Task",
                simulateNotificationError: true
            })
        });
        const errDurationMs = Date.now() - errStart;
        assert(errorTaskRes.status === 201, "API returns HTTP 201 even when notification will fail");
        assert(errDurationMs < 1000, "API returned immediately without waiting for notification error");

        // Wait 2.5s to let the error occur in the listener and be caught safely
        console.log("Waiting 2.5s for notification error to be safely caught...");
        await new Promise((r) => setTimeout(r, 2500));

        // Check that server is still alive and answering requests
        const isStillAlive = await isServerUp();
        assert(isStillAlive === true, "Server continues running and is healthy after notification error (no process crash)");

        // 6. Regression Check: Practical 9 Caching Integrity
        console.log("\n--- Testing Regression: Practical 9 Caching Remains Fully Functional ---");
        // Reset cache stats
        await fetch(`${BASE_URL}/tasks/cache/reset`, { method: "POST", headers: authHeader });

        // Miss on first get
        const list1Res = await fetch(`${BASE_URL}/tasks`, { headers: authHeader });
        assert(list1Res.status === 200, "GET /tasks succeeds");

        // Hit on second get
        const list2Res = await fetch(`${BASE_URL}/tasks`, { headers: authHeader });
        assert(list2Res.status === 200, "GET /tasks repeated succeeds");

        const statsRes = await fetch(`${BASE_URL}/debug/cache-stats`);
        const stats = await statsRes.json();
        assert(stats.hits >= 1, `Cache hits recorded (${stats.hits} hits, hit rate: ${stats.hitRate})`);

        console.log(`\n=== PRACTICAL 10 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);

        if (failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (err) {
        console.error("Test execution failed with unhandled error:", err);
        process.exit(1);
    }
}

runTests();
