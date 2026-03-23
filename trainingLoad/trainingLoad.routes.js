import express from "express";
import { poolPromise as usersPoolPromise } from "../config/dbUsers.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const pool = await usersPoolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool.request().query(`
      SELECT
        SIMULATORI.SIMULATORE,
        [sv_Load Configuration].*
      FROM SIMULATORI
      INNER JOIN [sv_Load Configuration]
        ON SIMULATORI.ID_SIM = [sv_Load Configuration].Simulator;
    `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /trainingLoad endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
