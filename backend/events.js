const EventEmitter = require("events");

class TaskEvents extends EventEmitter {}

// Export a single shared instance
const taskEvents = new TaskEvents();

module.exports = taskEvents;
