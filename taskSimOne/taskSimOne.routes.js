import express from "express";
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
    WHERE CAST([Scheduled on] AS DATE) = CAST(GETDATE() AS DATE)
`);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /taskSimOne endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
