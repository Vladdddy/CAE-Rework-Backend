import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });
        const result = await pool.request().query(`
            SELECT ID, EMPLOYEE_ID,
                CONVERT(VARCHAR(10), SELECTED_DATE, 23) AS SELECTED_DATE,
                CHANGE_TYPE
            FROM ShiftCellHighlight
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// Upsert a batch of highlights
router.post("/", async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: "items array required" });
    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });
        for (const item of items) {
            await pool
                .request()
                .input("EMPLOYEE_ID", sql.Int, item.employeeId)
                .input("SELECTED_DATE", sql.Date, item.date)
                .input("CHANGE_TYPE", sql.NVarChar(20), item.changeType).query(`
                    IF EXISTS (
                        SELECT 1 FROM ShiftCellHighlight
                        WHERE EMPLOYEE_ID = @EMPLOYEE_ID AND SELECTED_DATE = @SELECTED_DATE
                    )
                        UPDATE ShiftCellHighlight
                        SET CHANGE_TYPE = @CHANGE_TYPE
                        WHERE EMPLOYEE_ID = @EMPLOYEE_ID AND SELECTED_DATE = @SELECTED_DATE
                    ELSE
                        INSERT INTO ShiftCellHighlight (EMPLOYEE_ID, SELECTED_DATE, CHANGE_TYPE)
                        VALUES (@EMPLOYEE_ID, @SELECTED_DATE, @CHANGE_TYPE)
                `);
        }
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// Delete specific highlights by employee+date pairs
router.delete("/", async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ error: "items array required" });
    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });
        for (const item of items) {
            await pool
                .request()
                .input("EMPLOYEE_ID", sql.Int, item.employeeId)
                .input("SELECTED_DATE", sql.Date, item.date).query(`
                    DELETE FROM ShiftCellHighlight
                    WHERE EMPLOYEE_ID = @EMPLOYEE_ID AND SELECTED_DATE = @SELECTED_DATE
                `);
        }
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// Delete all highlights (called on save or cancel)
router.delete("/all", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool)
            return res.status(503).json({ error: "Database not connected" });
        await pool.request().query(`DELETE FROM ShiftCellHighlight`);
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
