const taskEvents = require("./events");

let listenersRegistered = false;

function registerListeners() {
    if (listenersRegistered) {
        console.log("[Events] Listeners already registered, skipping duplicate registration.");
        return;
    }

    // A. Task Created Event Listener
    taskEvents.on("task-created", (task) => {
        try {
            const eventTimestamp = new Date().toISOString();
            const taskTitle = task.title || "Untitled";
            const assignedUser = task.assignedUser || task.userId || "Mahek";

            console.log(`[Notification] Processing task: ${taskTitle}`);
            console.log(`[Notification] Assigned user: ${assignedUser}`);
            console.log(`[Notification] Event received at: ${eventTimestamp}`);

            // Simulate slow notification processing (e.g., email / SMS dispatch) using 2-second delay
            setTimeout(() => {
                try {
                    // Optional simulation hook for testing error handling
                    if (task.simulateNotificationError) {
                        throw new Error("Simulated email delivery network timeout");
                    }

                    const completionTimestamp = new Date().toISOString();
                    console.log(`[Notification] Completed: ${completionTimestamp}`);
                } catch (err) {
                    taskEvents.emit("task-notification-error", {
                        action: "task-created",
                        task,
                        error: err
                    });
                }
            }, 2000);
        } catch (err) {
            taskEvents.emit("task-notification-error", {
                action: "task-created-sync",
                task,
                error: err
            });
        }
    });

    // B. Task Deleted Event Listener
    taskEvents.on("task-deleted", (data) => {
        try {
            const eventTimestamp = new Date().toISOString();
            const taskId = data.taskId || data._id || data;

            console.log(`[Notification] Processing deletion for task: ${taskId}`);
            console.log(`[Notification] Deletion event received at: ${eventTimestamp}`);

            // Simulate slight async cleanup / audit notification
            setTimeout(() => {
                try {
                    if (data.simulateNotificationError) {
                        throw new Error("Simulated deletion audit logging failure");
                    }

                    const completionTimestamp = new Date().toISOString();
                    console.log(`[Notification] Task deletion notification logged: ${completionTimestamp}`);
                } catch (err) {
                    taskEvents.emit("task-notification-error", {
                        action: "task-deleted",
                        data,
                        error: err
                    });
                }
            }, 500);
        } catch (err) {
            taskEvents.emit("task-notification-error", {
                action: "task-deleted-sync",
                data,
                error: err
            });
        }
    });

    // C. Error Handling Listener
    // Catches errors occurring inside notification handlers without crashing the server
    taskEvents.on("task-notification-error", (errData) => {
        console.error(`[Event Error] Safe error caught during ${errData.action}: ${errData.error.message}`);
        if (errData.task) {
            console.error(`[Event Error] Affected Task ID: ${errData.task._id || errData.task.id}`);
        }
    });

    listenersRegistered = true;
    console.log("[Events] Event listeners registered successfully (task-created, task-deleted, task-notification-error).");
}

module.exports = {
    registerListeners
};
