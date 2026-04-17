import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/dbUsers.js";

const router = express.Router();

// GET / — list all active users from SimOneDB_copied
router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });

        const result = await pool.request().query(`
            SELECT userID, firstname, lastname, username, email, active, must_reset_psw
            FROM dbo.Users
            WHERE active = 1
            ORDER BY lastname, firstname ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching simone users:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// GET /:id — get user by ID
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });

        const result = await pool.request()
            .input("id", sql.Int, id)
            .query(`
                SELECT userID, firstname, lastname, username, email, active, must_reset_psw
                FROM dbo.Users
                WHERE userID = @id
            `);

        if (result.recordset.length === 0)
            return res.status(404).json({ error: "User not found" });

        res.json(result.recordset[0]);
    } catch (err) {
        console.error("Error fetching simone user:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// PUT /:id — update user fields
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { firstname, lastname, username, email } = req.body;

    if (!firstname || !lastname || !username || !email)
        return res.status(400).json({ error: "firstname, lastname, username and email are required" });

    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });

        const result = await pool.request()
            .input("id", sql.Int, id)
            .input("firstname", sql.NVarChar(100), firstname)
            .input("lastname", sql.NVarChar(100), lastname)
            .input("username", sql.NVarChar(100), username)
            .input("email", sql.NVarChar(255), email)
            .query(`
                UPDATE dbo.Users
                SET firstname = @firstname, lastname = @lastname, username = @username, email = @email
                WHERE userID = @id
            `);

        if (result.rowsAffected[0] === 0)
            return res.status(404).json({ error: "User not found" });

        res.json({ success: true });
    } catch (err) {
        console.error("Error updating simone user:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// DELETE /:id — soft delete (active = 0)
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });

        const result = await pool.request()
            .input("id", sql.Int, id)
            .query(`UPDATE dbo.Users SET active = 0 WHERE userID = @id`);

        if (result.rowsAffected[0] === 0)
            return res.status(404).json({ error: "User not found" });

        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting simone user:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
