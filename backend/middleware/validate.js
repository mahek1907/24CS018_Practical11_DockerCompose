const mongoose = require("mongoose");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegister(req, res, next) {
    let { email, password } = req.body;

    if (!email || typeof email !== "string" || email.trim() === "") {
        return res.status(400).json({
            message: "Email is required"
        });
    }

    if (!password || typeof password !== "string" || password.trim() === "") {
        return res.status(400).json({
            message: "Password is required"
        });
    }

    email = email.trim().toLowerCase();

    if (!emailRegex.test(email)) {
        return res.status(400).json({
            message: "Please enter a valid email address"
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            message: "Password must be at least 6 characters long"
        });
    }

    req.body.email = email;
    next();
}

function validateLogin(req, res, next) {
    let { email, password } = req.body;

    if (!email || typeof email !== "string" || email.trim() === "") {
        return res.status(400).json({
            message: "Email is required"
        });
    }

    if (!password || typeof password !== "string" || password.trim() === "") {
        return res.status(400).json({
            message: "Password is required"
        });
    }

    req.body.email = email.trim().toLowerCase();
    next();
}

function validateTask(req, res, next) {
    let { title, description, completed } = req.body;

    if (!title || typeof title !== "string" || title.trim() === "") {
        return res.status(400).json({
            message: "Task title is required and cannot be empty"
        });
    }

    req.body.title = title.trim();

    if (description !== undefined) {
        req.body.description = typeof description === "string" ? description.trim() : "";
    }

    if (completed !== undefined && typeof completed !== "boolean") {
        return res.status(400).json({
            message: "Completed must be a boolean value (true or false)"
        });
    }

    next();
}

function validateUpdateTask(req, res, next) {
    const { title, description, completed } = req.body;

    if (title === undefined && description === undefined && completed === undefined) {
        return res.status(400).json({
            message: "At least one field (title, description, completed) must be provided for update"
        });
    }

    if (title !== undefined) {
        if (typeof title !== "string" || title.trim() === "") {
            return res.status(400).json({
                message: "Task title cannot be empty"
            });
        }
        req.body.title = title.trim();
    }

    if (description !== undefined && typeof description === "string") {
        req.body.description = description.trim();
    }

    if (completed !== undefined && typeof completed !== "boolean") {
        return res.status(400).json({
            message: "Completed must be a boolean value (true or false)"
        });
    }

    next();
}

function validateTaskId(req, res, next) {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            message: "Invalid task ID format"
        });
    }

    next();
}

module.exports = {
    validateRegister,
    validateLogin,
    validateTask,
    validateUpdateTask,
    validateTaskId
};
