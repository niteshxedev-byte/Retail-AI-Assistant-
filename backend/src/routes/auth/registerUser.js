import { Router } from "express";
import bcrypt from "bcrypt";
import User from "../../models/User.js";

const registerRouter = Router();

// Route to register user without OTP
registerRouter.post("/register", async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: "Name, email, and password are required" });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "User already exists with this email" });
        }

        // Validate Role (Optional, defaults to Personal)
        const userRole = role === "Customer" ? "Customer" : "Personal";

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user (automatically set isVerified: true for now, or just leave as default)
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: userRole,
            isVerified: true // Set to true since we removed OTP
        });

        await newUser.save();

        res.status(201).json({ message: "Registration successful. You can now log in." });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error during registration" });
    }
});

export default registerRouter;