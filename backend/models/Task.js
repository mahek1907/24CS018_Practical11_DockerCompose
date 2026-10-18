const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Title is required"],
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ""
    },
    completed: {
        type: Boolean,
        default: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User ID is required"]
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Query Optimization: Compound index for user task listings sorted by createdAt
taskSchema.index({ userId: 1, createdAt: -1 });

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;