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

router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { assignedTo } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        await pool
            .request()
            .input("id", sql.Int, id)
            .input("assignedTo", sql.Int, assignedTo).query(`
            UPDATE [Yearly PM Plan]
            SET [AssignedTo] = @assignedTo
            WHERE [ID_task] = @id;
        `);

        res.status(200).json({ id: parseInt(id), assignedTo });
    } catch (err) {
        console.error("Error in /taskSimOne PUT endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
