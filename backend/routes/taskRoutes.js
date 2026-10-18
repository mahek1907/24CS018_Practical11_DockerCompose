const express = require("express");
const Task = require("../models/Task");
const auth = require("../middleware/auth");
const {
    validateTask,
    validateUpdateTask,
    validateTaskId
} = require("../middleware/validate");
const {
    cache,
    recordHit,
    recordMiss,
    getStats,
    resetStats,
    keys,
    invalidateUserTaskCaches
} = require("../config/cache");
const taskEvents = require("../events");

const router = express.Router();

// Apply Authentication Middleware to all task routes
router.use(auth);

// GET /tasks/cache/stats - Expose cache statistics (Supplementary)
router.get("/cache/stats", (req, res) => {
    res.status(200).json(getStats());
});

// POST /tasks/cache/reset - Reset cache statistics for testing
router.post("/cache/reset", (req, res) => {
    resetStats();
    res.status(200).json({ message: "Cache statistics reset", stats: getStats() });
});

// GET /tasks - Fetch all tasks for the authenticated user with in-memory caching
router.get("/", async (req, res, next) => {
    try {
        const cacheKey = keys.taskList(req.user.id);

        // 1. Check in-memory cache
        const cachedTasks = cache.get(cacheKey);

        if (cachedTasks !== undefined) {
            recordHit();
            // Cache Hit: Return in-memory data immediately
            return res.status(200).json(cachedTasks);
        }

        // 2. Cache Miss: Query MongoDB
        recordMiss();
        // Query optimization: use indexed fields (userId, createdAt) and .lean() for zero Mongoose document overhead
        const tasks = await Task.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .lean();

        // 3. Store query result in cache (default TTL: 60s)
        cache.set(cacheKey, tasks);

        res.status(200).json(tasks);
    } catch (error) {
        next(error);
    }
});

// GET /tasks/:id - Fetch single task with dedicated separate cache entry (Supplementary)
router.get("/:id", validateTaskId, async (req, res, next) => {
    try {
        const cacheKey = keys.singleTask(req.user.id, req.params.id);

        // 1. Check single-task in-memory cache
        const cachedTask = cache.get(cacheKey);

        if (cachedTask !== undefined) {
            recordHit();
            return res.status(200).json(cachedTask);
        }

        // 2. Cache Miss: Query MongoDB
        recordMiss();
        const task = await Task.findOne({
            _id: req.params.id,
            userId: req.user.id
        }).lean();

        if (!task) {
            return res.status(404).json({
                message: "Task not found or unauthorized"
            });
        }

        // 3. Cache only successful lookups
        cache.set(cacheKey, task);

        res.status(200).json(task);
    } catch (error) {
        next(error);
    }
});

// POST /tasks - Create a new task and invalidate relevant list cache
// Pipeline: Request -> auth -> validateTask -> handler -> database -> cache invalidation -> response -> event emission
router.post("/", validateTask, async (req, res, next) => {
    try {
        const { title, description, completed, assignedUser, simulateNotificationError } = req.body;

        const task = new Task({
            title,
            description: description || "",
            completed: completed || false,
            userId: req.user.id
        });

        const savedTask = await task.save();

        // Cache Invalidation: Clear list cache for this user so stale data is never served
        invalidateUserTaskCaches(req.user.id);

        const responsePayload = {
            message: "Task created successfully",
            task: savedTask
        };

        const now = new Date().toISOString();
        console.log(`[API] Task saved: ${now}`);

        // Return HTTP status 201 immediately before notification finishes
        res.status(201).json(responsePayload);

        console.log(`[API] Response sent: ${new Date().toISOString()}`);

        // Emit task-created event AFTER response is sent
        const eventData = savedTask.toObject ? savedTask.toObject() : { ...savedTask };
        eventData.assignedUser = assignedUser || req.user.email || "Mahek";
        if (simulateNotificationError) {
            eventData.simulateNotificationError = true;
        }

        taskEvents.emit("task-created", eventData);
    } catch (error) {
        next(error);
    }
});

// PUT /tasks/:id - Update task and invalidate both list and individual-task cache
// Pipeline: Request -> auth -> validateTaskId -> validateUpdateTask -> handler -> database -> cache invalidation
router.put("/:id", validateTaskId, validateUpdateTask, async (req, res, next) => {
    try {
        const task = await Task.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            {
                $set: {
                    ...(req.body.title !== undefined && { title: req.body.title }),
                    ...(req.body.description !== undefined && { description: req.body.description }),
                    ...(req.body.completed !== undefined && { completed: req.body.completed })
                }
            },
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!task) {
            return res.status(404).json({
                message: "Task not found or unauthorized"
            });
        }

        // Cache Invalidation: Clear list AND single task cache
        invalidateUserTaskCaches(req.user.id, req.params.id);

        res.status(200).json({
            message: "Task updated successfully",
            task
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /tasks/:id - Delete task and invalidate both list and individual-task cache
// Pipeline: Request -> auth -> validateTaskId -> handler -> database -> cache invalidation -> response -> event emission
router.delete("/:id", validateTaskId, async (req, res, next) => {
    try {
        const task = await Task.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!task) {
            return res.status(404).json({
                message: "Task not found or unauthorized"
            });
        }

        // Cache Invalidation: Clear list AND single task cache
        invalidateUserTaskCaches(req.user.id, req.params.id);

        const now = new Date().toISOString();
        console.log(`[API] Task deleted from DB: ${now}`);

        res.status(200).json({
            message: "Task deleted successfully"
        });

        console.log(`[API] Delete response sent: ${new Date().toISOString()}`);

        // Emit task-deleted event AFTER successful deletion
        taskEvents.emit("task-deleted", {
            taskId: req.params.id,
            userId: req.user.id,
            title: task.title,
            deletedAt: new Date().toISOString(),
            simulateNotificationError: req.query.simulateNotificationError === "true"
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
