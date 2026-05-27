import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/dbUsers.js";

const router = express.Router();

// GET / — list all organisational roles
router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool.request().query(`
            SELECT roleID, name, parentRoleID
            FROM dbo.OrgRoles
            ORDER BY name ASC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching org roles:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// GET /app/:appId — list AppRoles for a specific application
router.get("/app/:appId", async (req, res) => {
    const { appId } = req.params;
    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool
            .request()
            .input("appId", sql.Int, appId)
            .query(`
                SELECT appRoleID, appID, name
                FROM dbo.AppRoles
                WHERE appID = @appId
                ORDER BY name ASC
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error fetching app roles by app:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// GET /:id — get OrgRole by ID
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
                `SELECT roleID, name, parentRoleID FROM dbo.OrgRoles WHERE roleID = @id`,
            );

        if (result.recordset.length === 0)
            return res.status(404).json({ error: "Role not found" });

        res.json(result.recordset[0]);
    } catch (err) {
        console.error("Error fetching org role:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// POST / — create OrgRole
router.post("/", async (req, res) => {
    const { name, parentRoleID } = req.body;
    if (!name)
        return res.status(400).json({ error: "name is required" });

    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool
            .request()
            .input("name", sql.NVarChar(100), name)
            .input("parentRoleID", sql.Int, parentRoleID ?? null).query(`
                INSERT INTO dbo.OrgRoles (name, parentRoleID)
                OUTPUT INSERTED.roleID
                VALUES (@name, @parentRoleID)
            `);

        res.status(201).json({
            success: true,
            roleID: result.recordset[0].roleID,
        });
    } catch (err) {
        console.error("Error creating org role:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// PUT /:id — update OrgRole
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { name, parentRoleID } = req.body;
    if (!name)
        return res.status(400).json({ error: "name is required" });

    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool
            .request()
            .input("id", sql.Int, id)
            .input("name", sql.NVarChar(100), name)
            .input("parentRoleID", sql.Int, parentRoleID ?? null)
            .query(
                `UPDATE dbo.OrgRoles SET name = @name, parentRoleID = @parentRoleID WHERE roleID = @id`,
            );

        if (result.rowsAffected[0] === 0)
            return res.status(404).json({ error: "Role not found" });

        res.json({ success: true });
    } catch (err) {
        console.error("Error updating org role:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// DELETE /:id — delete OrgRole
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });

        const result = await pool
            .request()
            .input("id", sql.Int, id)
            .query(`DELETE FROM dbo.OrgRoles WHERE roleID = @id`);

        if (result.rowsAffected[0] === 0)
            return res.status(404).json({ error: "Role not found" });

        res.json({ success: true });
    } catch (err) {
        console.error("Error deleting org role:", err.message);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
