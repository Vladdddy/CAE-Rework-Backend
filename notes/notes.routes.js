import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/db.js";

const router = express.Router();

router.get("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }
        const result = await pool.request().input("id", sql.Int, id).query(`
              SELECT *
              FROM dbo.NoteTask
              WHERE TASKID = @id;
    `);

        console.log("DB result:", result.recordset);
        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /notes endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

router.post("/:id", async (req, res) => {
    const { id } = req.params;
    const { createdBy, description } = req.body;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool
            .request()
            .input("taskId", sql.Int, id)
            .input("createdBy", sql.Int, createdBy)
            .input("description", sql.NVarChar, description)
            .input("createdDate", sql.DateTime, new Date()).query(`
                INSERT INTO dbo.NoteTask (TASKID, CREATEDBY, DESCRIPTION, CREATEDDATE)
                VALUES (@taskId, @createdBy, @description, @createdDate)
            `);

        res.status(201).json({ message: "Note created successfully", result });
    } catch (err) {
        console.error("Error creating note:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
