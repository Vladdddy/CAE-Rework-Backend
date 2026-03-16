import express from "express";
import bcrypt from "bcrypt";
import sql from "mssql";
import jwt from "jsonwebtoken";
import { poolPromise } from "../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool.request().query(`
      SELECT *
      FROM Employee
      WHERE IsDeleted = 0;
    `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /users endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/register", async (req, res) => {
    const { username, password, role } = req.body;

    console.log("Received registration request for username:", username);

    if (!username || !password) {
        return res
            .status(400)
            .json({ error: "Username and password are required" });
    }

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        // Check if user already exists
        const existingUser = await pool
            .request()
            .input("username", sql.NVarChar, username)
            .query(
                "SELECT * FROM Employee WHERE Username = @username AND IsDeleted = 0",
            );

        if (existingUser.recordset.length > 0) {
            return res.status(409).json({ error: "Username already exists" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        await pool
            .request()
            .input("username", sql.NVarChar, username)
            .input("password", sql.NVarChar, hashedPassword)
            .input("role", sql.NVarChar, role || "Employee")
            .query(
                "INSERT INTO dbo.Employee (Username, PasswordHash, Role) VALUES (@username, @password, @role)",
            );

        console.log("Registration successful for", username);

        res.status(201).json({
            success: true,
            message: "User registered successfully",
        });
    } catch (err) {
        console.error("Error in /users/register endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    console.log("Received login request for username:", username);

    if (!username || !password) {
        return res
            .status(400)
            .json({ error: "Username and password are required" });
    }

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool
            .request()
            .input("username", sql.NVarChar, username).query(`
                SELECT *
                FROM Employee
                WHERE USERNAME = @username AND IsDeleted = 0
            `);

        if (result.recordset.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const user = result.recordset[0];

        if (!user.PasswordHash) {
            return res
                .status(500)
                .json({ error: "User password hash not found in database" });
        }

        const isValid = await bcrypt.compare(password, user.PasswordHash);

        if (!isValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Generate JWT token with 1 week expiration
        const token = jwt.sign(
            {
                id: user.ID,
                username: user.Username,
                role: user.Role,
                firstAccess: user.FIRST_ACCESS,
            },
            process.env.JWT_SECRET || "your-secret-key-change-this",
            { expiresIn: "7d" },
        );

        res.json({
            user: {
                id: user.ID,
                username: user.Username,
                role: user.Role,
                firstAccess: user.FIRST_ACCESS,
            },
            token,
        });
    } catch (err) {
        console.error("Error in /users/login endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/validate", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "No token provided" });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Token is valid, return user info
        res.json({
            valid: true,
            user: {
                id: decoded.id,
                username: decoded.username,
                role: decoded.role,
                firstAccess: decoded.firstAccess,
            },
        });
    } catch (err) {
        // Token is invalid or expired
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ error: "Token expired" });
        }
        if (err.name === "JsonWebTokenError") {
            return res.status(401).json({ error: "Invalid token" });
        }
        res.status(500).json({ error: "Server error", details: err.message });
    }
});

router.post("/:id/change-password", async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    console.log("Received password change request for user ID:", id);

    if (!password) {
        return res.status(400).json({ error: "Password is required" });
    }

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        // Check if user exists
        const userCheck = await pool
            .request()
            .input("id", sql.Int, id)
            .query("SELECT ID FROM Employee WHERE ID = @id");

        if (userCheck.recordset.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update the password and set FIRST_ACCESS to 0
        await pool
            .request()
            .input("id", sql.Int, id)
            .input("passwordHash", sql.NVarChar, hashedPassword)
            .query(
                "UPDATE Employee SET PasswordHash = @passwordHash, FIRST_ACCESS = 0 WHERE ID = @id",
            );

        console.log("Password changed successfully for user ID:", id);

        res.json({
            success: true,
            message: "Password changed successfully",
        });
    } catch (err) {
        console.error(
            "Error in /users/:id/change-password endpoint:",
            err.message,
        );
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
