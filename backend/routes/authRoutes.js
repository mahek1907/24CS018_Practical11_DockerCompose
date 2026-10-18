const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { validateRegister, validateLogin } = require("../middleware/validate");

const router = express.Router();

// POST /register
router.post("/register", validateRegister, async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                message: "Email is already registered"
            });
        }

        // Hash password with 10 salt rounds
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new user with hashed password only
        const newUser = new User({
            email,
            password: hashedPassword
        });

        const savedUser = await newUser.save();

        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: savedUser._id,
                email: savedUser.email,
                createdAt: savedUser.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /login
router.post("/login", validateLogin, async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // Sign JWT token valid for 1 hour
        const payload = {
            id: user._id,
            email: user.email
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: "1h"
        });

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                email: user.email
            }
        });
    } catch (error) {
        next(error);
    }
});

// GET /me
router.get("/me", auth, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.status(200).json({
            user: {
                id: user._id,
                email: user.email,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
