import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/dbUsers.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool.request().query(`
    SELECT *
    FROM [Yearly PM Plan]
    WHERE CAST([Scheduled on] AS DATE) >= '2025-01-01'
    AND [ID_sim] IN (1, 2, 3, 4, 5, 6, 13)
`);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /taskSimOne endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/unfinished-pm", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool.request().query(`
            SELECT *
            FROM [Yearly PM Plan]
            WHERE YEAR([Scheduled on]) = YEAR(GETDATE())
              AND CAST([Scheduled on] AS DATE) < CAST(GETDATE() AS DATE)
              AND [Task Done] = 0
              AND [ID_sim] IN (1, 2, 3, 4, 5, 6, 13)
            ORDER BY [Scheduled on]
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error(
            "Error in /taskSimOne/unfinished-pm endpoint:",
            err.message,
        );
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.get("/current-month", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool.request().query(`
            SELECT *
            FROM [Yearly PM Plan]
            WHERE YEAR([Scheduled on]) = YEAR(GETDATE())
              AND MONTH([Scheduled on]) = MONTH(GETDATE())
              AND [ID_sim] IN (1, 2, 3, 4, 5, 6, 13)
        `);

        res.json(result.recordset);
    } catch (err) {
        console.error(
            "Error in /taskSimOne/current-month endpoint:",
            err.message,
        );
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { assignedTo, taskDone, performedOn } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const setClauses = [];
        const request = pool.request().input("id", sql.Int, id);

        if (assignedTo !== undefined) {
            setClauses.push("[AssignedTo] = @assignedTo");
            request.input("assignedTo", sql.Int, assignedTo);
        }

        if (taskDone !== undefined) {
            setClauses.push("[Task Done] = @taskDone");
            request.input("taskDone", sql.Bit, taskDone ? 1 : 0);
        }

        if (performedOn !== undefined) {
            setClauses.push("[Performed on] = @performedOn");
            request.input(
                "performedOn",
                sql.DateTime,
                performedOn ? new Date(performedOn) : null,
            );
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: "No fields to update" });
        }

        await request.query(`
            UPDATE [Yearly PM Plan]
            SET ${setClauses.join(", ")}
            WHERE [ID_task] = @id;
        `);

        res.status(200).json({
            id: parseInt(id),
            assignedTo,
            taskDone,
            performedOn,
        });
    } catch (err) {
        console.error("Error in /taskSimOne PUT endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
