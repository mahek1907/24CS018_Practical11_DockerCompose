const NodeCache = require("node-cache");

// Initialize shared cache instance with 60 seconds default TTL and 120 seconds check period
const cache = new NodeCache({
    stdTTL: 60,
    checkperiod: 120,
    useClones: false // performance boost for in-memory reads
});

// Cache performance metrics counters
const cacheMetrics = {
    hits: 0,
    misses: 0,
    totalRequests: 0
};

function recordHit() {
    cacheMetrics.hits++;
    cacheMetrics.totalRequests++;
}

function recordMiss() {
    cacheMetrics.misses++;
    cacheMetrics.totalRequests++;
}

function getStats() {
    const total = cacheMetrics.totalRequests;
    const hitRate = total > 0 ? ((cacheMetrics.hits / total) * 100).toFixed(2) + "%" : "0.00%";
    
    return {
        hits: cacheMetrics.hits,
        misses: cacheMetrics.misses,
        totalRequests: cacheMetrics.totalRequests,
        hitRate: hitRate,
        activeKeys: cache.keys().length,
        defaultTTLSeconds: 60
    };
}

function resetStats() {
    cacheMetrics.hits = 0;
    cacheMetrics.misses = 0;
    cacheMetrics.totalRequests = 0;
}

// Consistent cache key generation ensuring user data isolation
const keys = {
    taskList: (userId) => `tasks_user_${userId}`,
    singleTask: (userId, taskId) => `task_user_${userId}_${taskId}`
};

// Invalidation helper
function invalidateUserTaskCaches(userId, taskId = null) {
    // 1. Invalidate list cache for this user
    cache.del(keys.taskList(userId));

    // 2. Invalidate individual task cache if taskId is provided
    if (taskId) {
        cache.del(keys.singleTask(userId, taskId));
    }
}

module.exports = {
    cache,
    recordHit,
    recordMiss,
    getStats,
    resetStats,
    keys,
    invalidateUserTaskCaches
};
