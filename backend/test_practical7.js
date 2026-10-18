const jwt = require("jsonwebtoken");

const BASE_URL = "http://localhost:5000";

let testPassed = 0;
let testFailed = 0;

function assert(condition, testName, details = "") {
    if (condition) {
        console.log(`✅ PASS: ${testName}`);
        testPassed++;
    } else {
        console.error(`❌ FAIL: ${testName} - ${details}`);
        testFailed++;
    }
}

async function runTests() {
    console.log("=== STARTING PRACTICAL 7 AUTOMATED VERIFICATION SUITE ===\n");

    const timestamp = Date.now();
    const userA = {
        email: `alice_${timestamp}@example.com`,
        password: "Password123!"
    };
    const userB = {
        email: `bob_${timestamp}@example.com`,
        password: "SecretPassword456!"
    };

    let tokenA = "";
    let userAData = null;
    let tokenB = "";
    let taskAId = "";

    // Test 1: Register User A successfully
    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userA)
        });
        const data = await res.json();
        assert(res.status === 201 && data.user && data.user.email === userA.email && !data.user.password,
            "1. Register a new user successfully (returns 201, safe user object, no password)",
            JSON.stringify(data));
    } catch (e) {
        assert(false, "1. Register a new user successfully", e.message);
    }

    // Test 2: Reject duplicate email registration
    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userA)
        });
        const data = await res.json();
        assert(res.status === 400 && data.message.includes("already registered"),
            "2. Reject duplicate email registration (returns 400 with error message)",
            `Status: ${res.status}, msg: ${data.message}`);
    } catch (e) {
        assert(false, "2. Reject duplicate email registration", e.message);
    }

    // Test 3: Reject missing or malformed registration fields
    try {
        // Missing password
        const res1 = await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "invalid@example.com" })
        });
        // Invalid email format
        const res2 = await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "notanemail", password: "Password123" })
        });
        // Short password (< 6 chars)
        const res3 = await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "valid@example.com", password: "123" })
        });

        assert(res1.status === 400 && res2.status === 400 && res3.status === 400,
            "3. Reject missing or malformed registration fields (returns 400 for missing, invalid email, short password)",
            `res1: ${res1.status}, res2: ${res2.status}, res3: ${res3.status}`);
    } catch (e) {
        assert(false, "3. Reject missing or malformed registration fields", e.message);
    }

    // Test 4: Log in with correct credentials
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userA)
        });
        const data = await res.json();
        tokenA = data.token;
        userAData = data.user;
        assert(res.status === 200 && !!tokenA && !!userAData && !userAData.password,
            "4. Log in with correct credentials (returns 200, JWT token, safe user)",
            JSON.stringify(data));
    } catch (e) {
        assert(false, "4. Log in with correct credentials", e.message);
    }

    // Test 5: Reject incorrect password
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: userA.email, password: "WrongPassword999!" })
        });
        const data = await res.json();
        assert(res.status === 401 && data.message.includes("Invalid"),
            "5. Reject incorrect password (returns 401 Unauthorized)",
            `Status: ${res.status}, msg: ${data.message}`);
    } catch (e) {
        assert(false, "5. Reject incorrect password", e.message);
    }

    // Test 6: Verify /me returns authenticated user's details without password
    try {
        const res = await fetch(`${BASE_URL}/me`, {
            headers: { Authorization: `Bearer ${tokenA}` }
        });
        const data = await res.json();
        assert(res.status === 200 && data.user && data.user.email === userA.email && !data.user.password,
            "6. GET /me returns authenticated user details without password hash",
            JSON.stringify(data));
    } catch (e) {
        assert(false, "6. GET /me returns authenticated user details", e.message);
    }

    // Test 7: Reject protected route requests without a token
    try {
        const res = await fetch(`${BASE_URL}/tasks`);
        const data = await res.json();
        assert(res.status === 401 && data.message.includes("Access denied"),
            "7. Reject requests without token on protected task routes (returns 401)",
            `Status: ${res.status}, msg: ${data.message}`);
    } catch (e) {
        assert(false, "7. Reject requests without token", e.message);
    }

    // Test 8: Reject expired, invalid, or tampered JWTs
    try {
        // Tampered token
        const tamperedToken = tokenA + "abc_tampered";
        const res1 = await fetch(`${BASE_URL}/tasks`, {
            headers: { Authorization: `Bearer ${tamperedToken}` }
        });

        // Expired token (create a token expired in the past)
        const expiredToken = jwt.sign({ id: userAData.id, email: userA.email }, process.env.JWT_SECRET || "p7_task_manager_secure_jwt_secret_key_2026_charusat", { expiresIn: "-1s" });
        const res2 = await fetch(`${BASE_URL}/tasks`, {
            headers: { Authorization: `Bearer ${expiredToken}` }
        });

        // Malformed header
        const res3 = await fetch(`${BASE_URL}/tasks`, {
            headers: { Authorization: "NotBearerToken" }
        });

        assert(res1.status === 401 && res2.status === 401 && res3.status === 401,
            "8. Reject expired, invalid, and tampered JWTs (all return 401)",
            `res1: ${res1.status}, res2: ${res2.status}, res3: ${res3.status}`);
    } catch (e) {
        assert(false, "8. Reject expired, invalid, or tampered JWTs", e.message);
    }

    // Test 9: Server validation middleware rejects missing title & malformed taskId
    try {
        // Missing title
        const res1 = await fetch(`${BASE_URL}/tasks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokenA}`
            },
            body: JSON.stringify({ description: "Missing title" })
        });

        // Empty title
        const res2 = await fetch(`${BASE_URL}/tasks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokenA}`
            },
            body: JSON.stringify({ title: "   ", description: "Empty title" })
        });

        // Malformed task ID in PUT
        const res3 = await fetch(`${BASE_URL}/tasks/invalid-id-12345`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokenA}`
            },
            body: JSON.stringify({ title: "Updated" })
        });

        assert(res1.status === 400 && res2.status === 400 && res3.status === 400,
            "9. Validation middleware rejects missing/empty task titles and malformed IDs (returns 400)",
            `res1: ${res1.status}, res2: ${res2.status}, res3: ${res3.status}`);
    } catch (e) {
        assert(false, "9. Validation middleware checks", e.message);
    }

    // Test 10: Access protected task routes using a valid JWT (Create task for User A)
    try {
        const res = await fetch(`${BASE_URL}/tasks`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokenA}`
            },
            body: JSON.stringify({
                title: "Complete Practical 7",
                description: "Implement Auth and Middleware Pipeline"
            })
        });
        const data = await res.json();
        taskAId = data.task?._id;
        assert(res.status === 201 && data.task && data.task.title === "Complete Practical 7" && data.task.userId === userAData.id,
            "10. Create task with valid JWT (returns 201 and stores userId ownership)",
            JSON.stringify(data));
    } catch (e) {
        assert(false, "10. Create task with valid JWT", e.message);
    }

    // Test 11: Register and Log in User B
    try {
        await fetch(`${BASE_URL}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userB)
        });
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userB)
        });
        const loginData = await loginRes.json();
        tokenB = loginData.token;
        assert(loginRes.status === 200 && !!tokenB,
            "11. Register & login second user (User B) for ownership isolation test");
    } catch (e) {
        assert(false, "11. Register & login second user", e.message);
    }

    // Test 12: User B cannot see User A's tasks (Ownership isolation on GET /tasks)
    try {
        const res = await fetch(`${BASE_URL}/tasks`, {
            headers: { Authorization: `Bearer ${tokenB}` }
        });
        const data = await res.json();
        const hasTaskA = Array.isArray(data) && data.some(t => t._id === taskAId);
        assert(res.status === 200 && !hasTaskA,
            "12. User B cannot see User A's tasks in GET /tasks (isolated task list)",
            `Tasks found for User B: ${data.length}`);
    } catch (e) {
        assert(false, "12. User B cannot see User A's tasks", e.message);
    }

    // Test 13: User B cannot update or delete User A's task
    try {
        const updateRes = await fetch(`${BASE_URL}/tasks/${taskAId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokenB}`
            },
            body: JSON.stringify({ title: "Hacked by User B" })
        });
        const deleteRes = await fetch(`${BASE_URL}/tasks/${taskAId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${tokenB}` }
        });

        assert(updateRes.status === 404 && deleteRes.status === 404,
            "13. User B cannot update or delete User A's task (returns 404 unauthorized/not found)",
            `update: ${updateRes.status}, delete: ${deleteRes.status}`);
    } catch (e) {
        assert(false, "13. User B cannot update or delete User A's task", e.message);
    }

    // Test 14: Practical 6 CRUD still fully functional for User A (Update and Delete)
    try {
        // User A updates own task
        const updateRes = await fetch(`${BASE_URL}/tasks/${taskAId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${tokenA}`
            },
            body: JSON.stringify({
                title: "Practical 7 Completed Successfully",
                completed: true
            })
        });
        const updateData = await updateRes.json();
        const updateOk = updateRes.status === 200 && updateData.task.completed === true;

        // User A fetches tasks
        const getRes = await fetch(`${BASE_URL}/tasks`, {
            headers: { Authorization: `Bearer ${tokenA}` }
        });
        const getData = await getRes.json();
        const getOk = getRes.status === 200 && getData.some(t => t._id === taskAId && t.completed === true);

        // User A deletes task
        const deleteRes = await fetch(`${BASE_URL}/tasks/${taskAId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${tokenA}` }
        });
        const deleteOk = deleteRes.status === 200;

        assert(updateOk && getOk && deleteOk,
            "14. Full Practical 6 CRUD (GET, POST, PUT, DELETE) preserved with MongoDB persistence",
            `updateOk: ${updateOk}, getOk: ${getOk}, deleteOk: ${deleteOk}`);
    } catch (e) {
        assert(false, "14. Full Practical 6 CRUD preserved", e.message);
    }

    // Test 15: Verify server is still alive and didn't crash
    try {
        const ping = await fetch(`${BASE_URL}/tasks`);
        assert(ping.status === 401,
            "15. Server stability verified (server remains healthy and did not crash under invalid requests)");
    } catch (e) {
        assert(false, "15. Server stability verified", e.message);
    }

    console.log(`\n=== TEST SUMMARY: ${testPassed} PASSED, ${testFailed} FAILED ===`);
    if (testFailed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests();
