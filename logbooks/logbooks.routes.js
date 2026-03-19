import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/db.js";
import path from "path";
import fs from "fs";

const router = express.Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR;
router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool.request().query(`
      SELECT *
      FROM Logbook
    `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /logbooks endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({
            error: "Database error",
            details: err.message,
        });
    }
});

router.post("/", async (req, res) => {
    const { logbook } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool
            .request()
            .input("title", sql.NVarChar, logbook.title)
            .input("description", sql.NVarChar, logbook.description)
            .input("assigned_to", sql.NVarChar, logbook.assigned_to)
            .input("simulator", sql.NVarChar, logbook.simulator)
            .input("category", sql.NVarChar, logbook.category)
            .input("subcategory", sql.NVarChar, logbook.subcategory)
            .input("extradetail", sql.NVarChar, logbook.extradetail)
            .input("status", sql.NVarChar, logbook.status)
            .input("date", sql.Date, logbook.date)
            .input("time", sql.NVarChar, logbook.time)
            .input("type", sql.NVarChar, logbook.type)
            .input("start_date", sql.Date, logbook.start_date)
            .input("end_date", sql.Date, logbook.end_date)
            .input("selected_days", sql.NVarChar, logbook.selected_days).query(`
      INSERT INTO dbo.Logbook (
        TITLE,
        DESCRIPTION,
        ASSIGNED_TO,
        SIMULATOR,
        CATEGORY,
        SUBCATEGORY,
        EXTRADETAIL,
        STATUS,
        DATE,
        TIME,
        TYPE,
        START_DATE,
        END_DATE,
        SELECTED_DAYS
      )
      VALUES (
        @title,
        @description,
        @assigned_to,
        @simulator,
        @category,
        @subcategory,
        @extradetail,
        @status,
        @date,
        @time,
        @type,
        @start_date,
        @end_date,
        @selected_days
      );
      SELECT SCOPE_IDENTITY() AS id;
    `);

        res.status(201).json({
            id: result.recordset[0].id,
            ...logbook,
        });
    } catch (err) {
        console.error("Error in /logbooks POST endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    console.log("Received DELETE request for logbook ID:", id);

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        await pool.request().input("logbookId", sql.Int, id).query(`
      DELETE FROM dbo.ImageLogbook
      WHERE LOGBOOK_ID = @logbookId;
    `);

        const result = await pool.request().input("id", sql.Int, id).query(`
      DELETE FROM dbo.Logbook
      WHERE ID = @id;
    `);

        const logbookFolderPath = path.join(UPLOAD_DIR, `Logbook-${id}`);
        if (fs.existsSync(logbookFolderPath)) {
            fs.rmSync(logbookFolderPath, { recursive: true, force: true });
        }

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Logbook not found" });
        }

        res.status(200).json({
            message: "Logbook deleted successfully",
            id: parseInt(id),
        });
    } catch (err) {
        console.error("Error in /logbooks DELETE endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { logbook } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        await pool
            .request()
            .input("id", sql.Int, id)
            .input("title", sql.NVarChar, logbook.title)
            .input("description", sql.NVarChar, logbook.description)
            .input("assigned_to", sql.NVarChar, logbook.assigned_to)
            .input("simulator", sql.NVarChar, logbook.simulator)
            .input("category", sql.NVarChar, logbook.category)
            .input("subcategory", sql.NVarChar, logbook.subcategory)
            .input("extradetail", sql.NVarChar, logbook.extradetail)
            .input("status", sql.NVarChar, logbook.status)
            .input("date", sql.Date, logbook.date)
            .input("time", sql.NVarChar, logbook.time).query(`
      UPDATE dbo.Logbook
      SET
        TITLE = @title,
        DESCRIPTION = @description,
        ASSIGNED_TO = @assigned_to,
        SIMULATOR = @simulator,
        CATEGORY = @category,
        SUBCATEGORY = @subcategory,
        EXTRADETAIL = @extradetail,
        STATUS = @status,
        DATE = @date,
        TIME = @time
      WHERE ID = @id;
    `);

        res.status(200).json({ id: parseInt(id), ...logbook });
    } catch (err) {
        console.error("Error in /logbooks PUT endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
