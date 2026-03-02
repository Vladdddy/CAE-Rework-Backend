import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool.request().query(`
      SELECT *
      FROM dbo.PatternShift
    `);

        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /patternShift endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/", async (req, res) => {
    const { name, shift_list, type } = req.body;
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool
            .request()
            .input("name", sql.NVarChar(50), name)
            .input("shift_list", sql.NVarChar(100), shift_list)
            .input("type", sql.NVarChar(20), type || "Personalized").query(`
      INSERT INTO dbo.PatternShift (
        NAME,
        SHIFT_LIST,
        TYPE
      )
      VALUES (
        @name,
        @shift_list,
        @type
      );
      SELECT SCOPE_IDENTITY() AS id;
    `);

        res.status(201).json({
            id: result.recordset[0].id,
            name,
            shift_list,
            type: type || "Personalized",
        });
    } catch (err) {
        console.error("Error in /patternShift POST endpoint:", err.message);
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
        await pool.request().input("id", sql.Int, id).query(`
      DELETE FROM dbo.PatternShift
      WHERE ID = @id;
    `);

        res.status(204).end();
    } catch (err) {
        console.error("Error in /patternShift DELETE endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
