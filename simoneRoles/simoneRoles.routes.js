import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/dbUsers.js";

const router = express.Router();

// GET / — list all roles
router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool.request().query(`
            SELECT r.roleID, r.appID, r.name, a.name AS appName
            FROM dbo.Roles r
            LEFT JOIN dbo.Applications a ON r.appID = a.appID
            ORDER BY r.appID, r.name ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching roles:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// GET /app/:appId — list roles for a specific application
router.get("/app/:appId", async (req, res) => {
    const { appId } = req.params;
    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool.request().input("appId", sql.Int, appId)
            .query(`
                SELECT roleID, appID, name
                FROM dbo.Roles
                WHERE appID = @appId
                ORDER BY name ASC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching roles by app:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// GET /:id — get role by ID
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool
            .request()
            .input("id", sql.Int, id)
            .query(
                `SELECT roleID, appID, name FROM dbo.Roles WHERE roleID = @id`,
            );

        if (result.recordset.length === 0)
            return res.status(404).json({ error: "Role not found" });

        res.json(result.recordset[0]);
    } catch (err) {
        console.error("Error fetching role:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// POST / — create role
router.post("/", async (req, res) => {
    const { appID, name } = req.body;
    if (!appID || !name)
        return res.status(400).json({ error: "appID and name are required" });

    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool
            .request()
            .input("appID", sql.Int, appID)
            .input("name", sql.NVarChar(100), name).query(`
                INSERT INTO dbo.Roles (appID, name)
                OUTPUT INSERTED.roleID
                VALUES (@appID, @name)
            `);

        res.status(201).json({
            success: true,
            roleID: result.recordset[0].roleID,
        });
    } catch (err) {
        console.error("Error creating role:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// PUT /:id — update role
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { appID, name } = req.body;
    if (!appID || !name)
        return res.status(400).json({ error: "appID and name are required" });

    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool
            .request()
            .input("id", sql.Int, id)
            .input("appID", sql.Int, appID)
            .input("name", sql.NVarChar(100), name)
            .query(
                `UPDATE dbo.Roles SET appID = @appID, name = @name WHERE roleID = @id`,
            );

        if (result.rowsAffected[0] === 0)
            return res.status(404).json({ error: "Role not found" });

        res.json({ success: true });
    } catch (err) {
        console.error("Error updating role:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// DELETE /:id — delete role
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool
            .request()
            .input("id", sql.Int, id)
            .query(`DELETE FROM dbo.Roles WHERE roleID = @id`);

        if (result.rowsAffected[0] === 0)
            return res.status(404).json({ error: "Role not found" });

        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting role:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
