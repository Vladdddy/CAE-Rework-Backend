import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/dbUsers.js";

const router = express.Router();

// GET / — list all applications
router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });

        const result = await pool.request().query(`
            SELECT appID, name
            FROM dbo.Applications
            ORDER BY name ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching applications:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// GET /:id — get application by ID
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });

        const result = await pool.request()
            .input("id", sql.Int, id)
            .query(`SELECT appID, name FROM dbo.Applications WHERE appID = @id`);

        if (result.recordset.length === 0)
            return res.status(404).json({ error: "Application not found" });

        res.json(result.recordset[0]);
    } catch (err) {
        console.error("Error fetching application:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// POST / — create application
router.post("/", async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });

        const result = await pool.request()
            .input("name", sql.NVarChar(100), name)
            .query(`
                INSERT INTO dbo.Applications (name)
                OUTPUT INSERTED.appID
                VALUES (@name)
            `);

        res.status(201).json({ success: true, appID: result.recordset[0].appID });
    } catch (err) {
        console.error("Error creating application:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// PUT /:id — update application
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });

        const result = await pool.request()
            .input("id", sql.Int, id)
            .input("name", sql.NVarChar(100), name)
            .query(`UPDATE dbo.Applications SET name = @name WHERE appID = @id`);

        if (result.rowsAffected[0] === 0)
            return res.status(404).json({ error: "Application not found" });

        res.json({ success: true });
    } catch (err) {
        console.error("Error updating application:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// DELETE /:id — delete application
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        if (!pool) return res.status(503).json({ error: "Database not connected" });

        const result = await pool.request()
            .input("id", sql.Int, id)
            .query(`DELETE FROM dbo.Applications WHERE appID = @id`);

        if (result.rowsAffected[0] === 0)
            return res.status(404).json({ error: "Application not found" });

        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting application:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
