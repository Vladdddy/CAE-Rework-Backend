import express from "express";
import sql from "mssql";
import { poolPromise } from "../config/dbUsers.js";

const router = express.Router();

// GET all tech comments
router.get("/", async (req, res) => {
    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool.request().query(`
            SELECT *
            FROM YearlyPMTechComments
            ORDER BY CommentDate DESC
        `);

        console.log(
            "DB result: Fetched all tech comments",
            result.recordset.length,
        );
        res.json(result.recordset);
    } catch (err) {
        console.error("Error in /yearlyPMTechComments endpoint:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// GET tech comments by RecordID
router.get("/:recordId", async (req, res) => {
    const { recordId } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool.request().input("recordId", sql.Int, recordId)
            .query(`
                SELECT *
                FROM YearlyPMTechComments
                WHERE RecordID = @recordId
                ORDER BY CommentDate DESC
            `);

        console.log(
            "DB result: Fetched tech comments for RecordID:",
            recordId,
            result.recordset.length,
        );
        res.json(result.recordset);
    } catch (err) {
        console.error(
            "Error in /yearlyPMTechComments/:recordId endpoint:",
            err.message,
        );
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// POST - Create new tech comment
router.post("/", async (req, res) => {
    const { recordId, techComment, techName } = req.body;

    // Validate required fields
    if (!recordId || !techComment || !techName) {
        return res.status(400).json({
            error: "Missing required fields",
            details: "recordId, techComment, and techName are required",
        });
    }

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool
            .request()
            .input("recordId", sql.Int, recordId)
            .input("techComment", sql.NVarChar, techComment)
            .input("commentDate", sql.SmallDateTime, new Date())
            .input("techName", sql.NVarChar, techName).query(`
                INSERT INTO YearlyPMTechComments (RecordID, TechComment, CommentDate, TechName)
                VALUES (@recordId, @techComment, @commentDate, @techName)
                SELECT SCOPE_IDENTITY() as ID
            `);

        const newId = result.recordset[0].ID;
        console.log("DB result: Created new tech comment with ID:", newId);

        res.status(201).json({
            message: "Tech comment created successfully",
            id: newId,
            recordId,
            techComment,
            commentDate: new Date(),
            techName,
        });
    } catch (err) {
        console.error("Error creating tech comment:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// PUT - Update tech comment
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { techComment, techName } = req.body;

    // Validate required fields
    if (!techComment || !techName) {
        return res.status(400).json({
            error: "Missing required fields",
            details: "techComment and techName are required",
        });
    }

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool
            .request()
            .input("id", sql.Int, id)
            .input("techComment", sql.NVarChar, techComment)
            .input("techName", sql.NVarChar, techName).query(`
                UPDATE YearlyPMTechComments
                SET TechComment = @techComment, TechName = @techName
                WHERE ID = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                error: "Tech comment not found",
                details: `Tech comment with ID ${id} does not exist`,
            });
        }

        console.log("DB result: Updated tech comment with ID:", id);
        res.status(200).json({
            message: "Tech comment updated successfully",
            id: parseInt(id),
            techComment,
            techName,
        });
    } catch (err) {
        console.error("Error updating tech comment:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

// DELETE - Delete tech comment
router.delete("/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await poolPromise;
        if (!pool) {
            return res.status(503).json({ error: "Database not connected" });
        }

        const result = await pool.request().input("id", sql.Int, id).query(`
                DELETE FROM YearlyPMTechComments
                WHERE ID = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                error: "Tech comment not found",
                details: `Tech comment with ID ${id} does not exist`,
            });
        }

        console.log("DB result: Deleted tech comment with ID:", id);
        res.status(200).json({
            message: "Tech comment deleted successfully",
            id: parseInt(id),
        });
    } catch (err) {
        console.error("Error deleting tech comment:", err.message);
        console.error("Full error:", err);
        res.status(500).json({ error: "Database error", details: err.message });
    }
});

export default router;
