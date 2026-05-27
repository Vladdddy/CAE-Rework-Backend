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
      FROM Task
    `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /tasks endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({
            error: "Database error",
            details: err.message,
        });
    }
});

router.post("/", async (req, res) => {
    const { task } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool
            .request()
            .input("title", sql.NVarChar, task.title)
            .input("description", sql.NVarChar, task.description)
            .input("assigned_to", sql.NVarChar, task.assigned_to)
            .input("simulator", sql.NVarChar, task.simulator)
            .input("category", sql.NVarChar, task.category)
            .input("subcategory", sql.NVarChar, task.subcategory)
            .input("extradetail", sql.NVarChar, task.extradetail)
            .input("status", sql.NVarChar, task.status)
            .input("date", sql.Date, task.date)
            .input("time", sql.NVarChar, task.time)
            .input("type", sql.NVarChar, task.type)
            .input("start_date", sql.Date, task.start_date)
            .input("end_date", sql.Date, task.end_date)
            .input("selected_days", sql.NVarChar, task.selected_days)
            .input("isFlagged", sql.Bit, task.isFlagged)
            .input("from_logbook_id", sql.Int, task.from_logbook_id != null ? task.from_logbook_id : null).query(`
      INSERT INTO dbo.Task (
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
        SELECTED_DAYS,
        IS_FLAGGED,
        FROM_LOGBOOK_ID
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
        @selected_days,
        @isFlagged,
        @from_logbook_id
      );
      SELECT SCOPE_IDENTITY() AS id;
    `);

        res.status(201).json({
            id: result.recordset[0].id,
            ...task,
        });
    } catch (err) {
        console.error("Error in /tasks POST endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        await pool.request().input("taskId", sql.Int, id).query(`
      DELETE FROM dbo.ImageTask
      WHERE TASK_ID = @taskId;
    `);

        const taskDeleteResult = await pool.request().input("id", sql.Int, id)
            .query(`
            DELETE FROM dbo.Task
            WHERE ID = @id;
        `);

        const taskFolderPath = path.join(UPLOAD_DIR, `Task-${id}`);
        if (fs.existsSync(taskFolderPath)) {
            fs.rmSync(taskFolderPath, { recursive: true, force: true });
        }

        if (taskDeleteResult.rowsAffected?.[0] === 0) {
            return res.status(404).json({ error: "Task not found" });
        }

        res.status(204).end();
    } catch (err) {
        console.error("Error in /tasks DELETE endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { task } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        await pool
            .request()
            .input("id", sql.Int, id)
            .input("title", sql.NVarChar, task.title)
            .input("description", sql.NVarChar, task.description)
            .input("assigned_to", sql.NVarChar, task.assigned_to)
            .input("simulator", sql.NVarChar, task.simulator)
            .input("category", sql.NVarChar, task.category)
            .input("subcategory", sql.NVarChar, task.subcategory)
            .input("extradetail", sql.NVarChar, task.extradetail)
            .input("status", sql.NVarChar, task.status)
            .input("date", sql.Date, task.date)
            .input("time", sql.NVarChar, task.time)
            .input("isFlagged", sql.Bit, task.isFlagged)
            .input("completed_by", sql.Int, task.completed_by != null ? task.completed_by : null).query(`
      UPDATE dbo.Task
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
        TIME = @time,
        IS_FLAGGED = @isFlagged,
        COMPLETED_BY = @completed_by
      WHERE ID = @id;
    `);

        res.status(200).json({ id: parseInt(id), ...task });
    } catch (err) {
        console.error("Error in /tasks PUT endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
